from django.test import TestCase
from django.urls import reverse

from .models import Usuario


class HealthcheckTests(TestCase):
    def test_healthz_responde_ok(self):
        response = self.client.get(reverse('healthz'))
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {'status': 'ok'})


class AuthFlowTests(TestCase):
    def setUp(self):
        self.user = Usuario.objects.create_user(
            username='admin_test',
            password='1234',
            nombre_completo='Usuario Admin Test',
            rol='ADMIN',
            activo=True,
        )

    def test_pagina_principal_redirige_si_no_autenticado(self):
        response = self.client.get(reverse('pagina_principal'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('login'), response.url)

    def test_login_y_acceso_a_pagina_principal(self):
        login_ok = self.client.login(username='admin_test', password='1234')
        self.assertTrue(login_ok)
        response = self.client.get(reverse('pagina_principal'))
        self.assertEqual(response.status_code, 200)
