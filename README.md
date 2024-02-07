## Retirement Announcement
At this point in time, we've decided to retire the FallingRock project and place it into maintenance mode,
and Trueaccord will no longer be managing and maintaining this project.

We'd like to extend a huge thanks and our gratitude to all of the contributors to this project that
have helped us to get this project to where it is today and for accompanying us on this journey!

If you run into any issues with this project that you believe require attention or wish to enhance
it, feel free to fork this repository however we may decide to delete this repository at a future
point in time.

## Original README

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

Search for an okta group named 'Engineering':

    ldapsearch -h localhost -p 1389 -D "uid=admin,ou=system" -w ADMINPASS -b "ou=groups,dc=domain,dc=com" "(&(objectclass=groupOfNames)(cn=Engineering))"

Note: If you attempt to use an LDAP GUI like Apache Directory Studio, it will not work as the application does not return the standard root objects.

Advanced use
------------

You can customize the attributes for users and groups by setting
`okta.userAttributes` and `okta.groupAttributes` in the config. To see the
default look into [defaults.js](https://github.com/trueaccord/FallingRock/blob/master/defaults.js).

For Okta user default profile keys, see [Okta API - Profile Object](http://developer.okta.com/docs/api/resources/users#profile-object).

Docker Image
------------
To run the docker container:

```
docker run --name fallingrock \
  -p 1389:1389 \
  -v /server/path/to/config/:/cfg/ \
  trueaccord/fallingrock /cfg/config.yaml
```
