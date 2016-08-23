var winston = require('winston');
var request = require('request');

function createOktaClient(oktaConfig) {
    function getNext(req) {
        var link = req.headers.link;
        if (!link) { return null; }
        var a = link.match(/<(http[^>]+)>; rel="next"/);
        return a ? a[1] : null
    }

    function getOktaList(initialURL) {
        var p = new Promise(function(resolve, reject) {
            function getInner(url, acc) {
                request(url, {
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': 'SSWS ' + oktaConfig.token
                    },
                    json: true
                }, function(error, response, body) {
                    if (error || response.statusCode !== 200) {
                        reject(error || body.errorSummary);
                    } else {
                        var nextUrl = getNext(response);
                        var current = acc.concat(body);
                        if (nextUrl !== null) {
                            getInner(nextUrl, current);
                        } else {
                            resolve(current);
                        }
                    }
                });
            }

            getInner(initialURL, []);
        });

        return p;
    }

    function getOktaGroups() {
        winston.info('Fetching okta groups');
        return getOktaList(`${oktaConfig.url}/api/v1/groups?limit=200`);
    }

    function getOktaUsers() {
        winston.info('Fetching okta users');
        return getOktaList(`${oktaConfig.url}/api/v1/users?limit=10&filter=status+eq+"ACTIVE"`);
    }

    function loadOktaMembers(groups) {
        var CHUNK = 20;
        return new Promise(function(resolve, reject) {
            function inner(innerGroups) {
                var chunk = innerGroups.slice(0, CHUNK);
                var rest = innerGroups.slice(CHUNK);
                var p = chunk.map(function(g) {
                    winston.info("Fetching Okta members for group '%s'", g.profile.name);
                    return getOktaList(g._links.users.href).then(function(mems) {
                        g.members = mems.map(function(r) { return r.id; });
                    });
                });
                Promise.all(p).then(function(r) {
                    if (rest.length > 0) {
                        inner(rest);
                    } else {
                        resolve(groups);
                    }
                }, function(r) {
                    reject(r);
                });
            }

            inner(groups);
        });
    }

    function buildOktaDirectory() {
        var groups = getOktaGroups().then(function(groups) {
            return loadOktaMembers(groups);
        });
        var users = getOktaUsers();
        return Promise.all([groups, users]).then(
            function(groupsUsers) {
                var directory = {
                    groups: groupsUsers[0],
                    users: groupsUsers[1]
                };
                // link from users to groups and groups to users.
                var usersById = {};
                directory.users.forEach(function(u) {
                    usersById[u.id] = u;
                });
                var groupsById = {};
                directory.groups.forEach(function(g) {
                    groupsById[g.id] = g;
                    var members = [];
                    g.members.forEach(function(userId) {
                        if (userId in usersById) {
                            var u = usersById[userId];
                            u.groups = u.groups || [];
                            u.groups.push(g);
                            members.push(u);
                        }
                    });
                    g.members = members;
                });
                return directory;
            });
    }

    function checkUserAndPassword(username, password) {
      return new Promise(function(resolve, reject) {
          request(
              `${oktaConfig.url}/api/v1/authn`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                      'Authorization': 'SSWS ' + oktaConfig.token
                  },
                  json:{'username': username, 'password': password},
              }, function (error, response, body) {
                  var isSuccess = (response.statusCode === 200);
                  if (isSuccess) {
                      winston.info('Login success for %s', username);
                      resolve(true);
                  } else {
                      winston.info('Login failure for %s: %s', username, body.errorSummary);
                      reject(false);
                  }
              });
      });
    }

    return {
        buildOktaDirectory: buildOktaDirectory,
        checkUserAndPassword: checkUserAndPassword
    };
}

module.exports = {
    newClient: function(oktaConfig) {
        return createOktaClient(oktaConfig);
    }
};
