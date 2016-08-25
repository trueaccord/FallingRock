Falling Rock
-----------

Provides a read-only LDAP server for your Okta user directory.

This is useful for situations where you want to provide your users access to
some application which only support authentication via LDAP.

Getting started
---------------

Copy `config.yaml.sample` to `config.yaml`. Edit your copy `config.yaml` by
replacing the `DOMAIN` with your domain name. You also need to put in a
password for your ldap server as well Okta API key.

Run it:

  nodejs ./server.js 

It will start by loading your Okta directory (the time depends on your
directory size). Eventually, it will print:

```
info: New in-memory database load completed.
info: LDAP server listening at ldap://0.0.0.0:1389
```

At this point, your LDAP server is ready.

You can try it out using the `ldapsearch` command line utility:

Search by user id:

    ldapsearch -h localhost -p 1389 -D "uid=admin,ou=system" -w ADMINPASS -b "ou=users,dc=domain,dc=com" "(&(objectclass=inetorgperson)(uid=some_okta_user))"

Find groups:

    ldapsearch -h localhost -p 1389 -D "uid=admin,ou=system" -w ADMINPASS -b "ou=groups,dc=domain,dc=com"

Advanced use
------------

You can customize the attributes for users and groups by setting
`okta.userAttributes` and `okta.groupAttributes` in the config. To see the
default look into [defaults.js](https://github.com/trueaccord/FallingRock/blob/master/defaults.js).

