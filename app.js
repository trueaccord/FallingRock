var ldap = require('ldapjs');
var request = require('request');
var fs = require('fs');
var yaml = require('js-yaml');
var winston = require('winston');
var mustache = require('mustache');
var argv = require('yargs')
    .alias('c', 'config')
    .alias('p', 'port')
    .alias('h', 'help')
    .default('config', './config.yaml')
    .describe('config', 'Path to yaml config file')
    .default('port', 1389)
    .describe('port', 'Port for LDAP server')
    .help('h')
    .argv;

var config = yaml.safeLoad(fs.readFileSync(argv.config, 'utf8'));
var okta = require('./okta').newClient(config.okta);
var configDefaults = require('./defaults');

config.okta.userAttributes =
    config.okta.userAttributes || configDefaults.DEFAULT_USER_TEMPLATE;

config.okta.groupAttributes =
    config.okta.groupAttributes || configDefaults.DEFAULT_GROUP_TEMPLATE;

function addParents(db, dn) {
    var dn = ldap.parseDN(dn)
    while (true) {
        var dn = dn.parent();
        var dnString = dn.toString();
        if (dnString === '') {
            return;
        }
        db[dnString] = {attributes: {}, original: {}};
    }
}

var Container = {
};

function buildDatabase() {
    winston.info('Loading in-memory database.');
    return okta.buildOktaDirectory().then(function(oktaDirectory) {
        oktaDirectory.groups.forEach(function(group) {
            var dn = interpolateObject(config.okta.groupDN, group);
            group.dn = ldap.parseDN(dn).toString();
        });

        oktaDirectory.users.forEach(function(user) {
            user.shortName = user.profile.email.split('@')[0];
            var dn = interpolateObject(config.okta.userDN, user);
            user.dn = ldap.parseDN(dn).toString();
        });

        var db = {};
        addParents(db, config.okta.userDN);
        addParents(db, config.okta.groupDN);

        oktaDirectory.groups.forEach(function(group) {
            var o = interpolateObject(config.okta.groupAttributes, group);
            db[group.dn] = {attributes: o, original: group, type: 'group'};
        });
        oktaDirectory.users.forEach(function(user) {
            var o = interpolateObject(config.okta.userAttributes, user);
            db[user.dn] = {attributes: o, original: user, type: 'user'};
        });
        winston.info('New in-memory database load completed.');
        Container.db = db;
        return db;
    }, function(r) {
        winston.error('Failed to load database: %s', r);
        throw r;
    });
}

function authorize(req, res, next) {
  /* Any user may search after bind, only cn=root has full power */
  if (!req.connection.ldap.bindDN.equals(config.admin.username)) {
    return next(new ldap.InsufficientAccessRightsError());
  }

  return next();
}

function getCurrentDB() {
    return Container.db;
}

buildDatabase().then(function(someDatabase) {
    var reload_secs = (config.okta.reload_secs || 3600) * 1000;
    if (reload_secs >= 0) {
        setInterval(buildDatabase, reload_secs);
    }

    var server = ldap.createServer();

    server.bind(config.admin.username, function(req, res, next) {
        if (!req.dn.equals(config.admin.username)) {
            winston.info('Got a bind for a child of the admin user: %s', req.dn.toString());
            return next(new ldap.NoSuchObjectError(req.dn.toString()));
        }
        if (req.credentials !== config.admin.password) {
            winston.info('Got invalid credentials for admin user.');
            return next(new ldap.InvalidCredentialsError());
        }
        res.end();
        return next();
    });

    server.search('', authorize, function(req, res, next) {
        var db = getCurrentDB();
        var dn = req.dn.toString();
        if (!db[dn]) {
            return next(new ldap.NoSuchObjectError(dn));
        }

        var scopeCheck;

        switch (req.scope) {
            case 'base':
                if (req.filter.matches(db[dn].attributes)) {
                    res.send({
                        dn: dn,
                        attributes: db[dn].attributes
                    });
                }

                res.end();
                return next();

            case 'one':
                scopeCheck = function(k) {
                    if (req.dn.equals(k)) {
                        return true;
                    }

                    var parent = ldap.parseDN(k).parent();
                    return (parent ? parent.equals(req.dn) : false);
                };
                break;

            case 'sub':
                scopeCheck = function(k) {
                    return (req.dn.equals(k) || req.dn.parentOf(k));
                };

                break;
        }

        Object.keys(db).forEach(function(key) {
            if (!scopeCheck(key)) {
                return;
            }
            var matches = false;
            try {
                matches = req.filter.matches(db[key].attributes);
            } catch(e) {
            }

            if (matches) {
                res.send({
                    dn: key,
                    attributes: db[key].attributes
                });
            }
        });

        res.end();
        return next();
    });

    server.bind('', authorize, function(req, res, next) {
        var db = getCurrentDB();
        var dn = req.dn.toString();
        if (!db[dn] || db[dn].type !== 'user') {
            return next(new ldap.NoSuchObjectError(dn));
        }
        var u = db[dn].original;
        okta.checkUserAndPassword(u.profile.login, req.credentials).then(
            function(r) {
                res.end();
                next();
            },
            function(r) {
                next(new ldap.InvalidCredentialsError(dn));
            });
    });

    server.listen(argv.port, function() {
      winston.info('LDAP server listening at %s', server.url);
    });
});

function interpolateObject(template, values) {
    if (template instanceof Array) {
        return template.map(function(i) { return interpolateObject(i, values); });
    } else if (template instanceof Object) {
        if ('__list' in template) {
            // special case for list template
            return (values[template['__list']] || []).map(function(item) {
                return interpolateObject(template.item, {item: item});
            });
        }
        var result = {};
        Object.keys(template).forEach(function (key) {
            result[key] = interpolateObject(template[key], values);
        });
        return result;
    } else if (typeof template == 'string') {
        return mustache.render(template, values);
    } else {
        winston.error(`Unexpected type ${typeof template}:"${template}"`);
        throw (`Unexpected type ${typeof template}:"${template}"`);
    }
}

