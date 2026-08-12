{
    'name': 'Aaqify Backend Theme',
    'version': '18.0.1.0',
    'sequence': 7,
    'summary': 'Aaqify Backend Theme',
    "author": "Aaqib Bajwa",
    'license': 'AGPL-3',
    'maintainer': 'Aaqib',
    'company': 'Aaqib Bajwa',
    'website': 'https://aaqibbajwa.com',
    'depends': [
        'web'
    ],
    'category':'Branding',
    'description': """
           Odoo Aaqify Backend Theme
    """,
    'assets': {
        'web.assets_backend': [
            ('prepend', '/aaqify_backed_theme/static/src/scss/primary_variables_custom.scss'),
            '/aaqify_backed_theme/static/src/scss/secondary_variables.scss',
            '/aaqify_backed_theme/static/src/scss/fields_extra_custom.scss',
            '/aaqify_backed_theme/static/src/scss/custom_home_menu.scss',
            '/aaqify_backed_theme/static/src/js/custom_home_menu.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': True,
    'price': 0.00,
    'currency': 'USD',
    'images': ['static/description/main_screenshot.gif'],
}
