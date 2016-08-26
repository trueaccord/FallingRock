module.exports = {
    DEFAULT_USER_TEMPLATE: {
        'objectClass': ['top', 'person', 'organizationalPerson', 'inetOrgPerson'],
        'cn': '{{{profile.firstName}}} {{{profile.lastName}}}',
        'displayName': '{{{profile.firstName}}} {{{profile.lastName}}}',
        'givenName': '{{{profile.firstName}}}',
        'sn': '{{{profile.lastName}}}',
        'mail': '{{{profile.email}}}',
        'employeeNumber': '{{{profile.employeeNumber}}}',
        'uid': '{{{shortName}}}',
        'memberOf': {
            '__list': 'groups',
            'item': "{{{item.dn}}}"
        }
    },

    DEFAULT_GROUP_TEMPLATE: {
        'objectClass': 'groupOfNames',
        'cn': '{{{profile.name}}}',
        'description': '{{{profile.description}}}',
        'member': {
            '__list': 'members',
            'item': "{{{item.dn}}}"
        }
    }
};
