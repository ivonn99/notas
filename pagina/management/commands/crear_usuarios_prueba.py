"""
Comando para crear usuarios de prueba
Ejecutar: python manage.py crear_usuarios_prueba
"""
from django.core.management.base import BaseCommand
from pagina.models import Usuario


class Command(BaseCommand):
    help = 'Crea usuarios de prueba para cada rol'

    def handle(self, *args, **options):
        usuarios_prueba = [
            {
                'username': 'zoram',
                'password': '1995',
                'email': 'zoram@dmh.com',
                'nombre_completo': 'Zoram Usuario',
                'rol': 'ADMIN',
                'is_superuser': True,
                'is_staff': True,
            },
            {
                'username': 'vendedor1',
                'password': 'vendedor123',
                'email': 'vendedor1@dmh.com',
                'nombre_completo': 'Vendedor de Prueba',
                'rol': 'VENDEDOR',
                'is_superuser': False,
                'is_staff': False,
            },
            {
                'username': 'credito1',
                'password': 'credito123',
                'email': 'credito1@dmh.com',
                'nombre_completo': 'Crédito y Cobranza',
                'rol': 'CREDITO',
                'is_superuser': False,
                'is_staff': False,
            },
        ]
        
        creados = 0
        actualizados = 0
        
        for user_data in usuarios_prueba:
            password = user_data.pop('password')
            
            usuario, created = Usuario.objects.update_or_create(
                username=user_data['username'],
                defaults=user_data
            )
            
            # Establecer contraseña
            usuario.set_password(password)
            usuario.save()
            
            if created:
                creados += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'[OK] Creado usuario: {usuario.username} ({usuario.get_rol_display()})'
                    )
                )
            else:
                actualizados += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'[ACTUALIZADO] Usuario: {usuario.username} ({usuario.get_rol_display()})'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n[OK] Proceso completado: {creados} creados, {actualizados} actualizados'
            )
        )
        
        self.stdout.write('\nUsuarios creados:')
        self.stdout.write('  - zoram (ADMIN) - Password: 1995')
        self.stdout.write('  - vendedor1 (VENDEDOR) - Password: vendedor123')
        self.stdout.write('  - credito1 (CREDITO) - Password: credito123')




