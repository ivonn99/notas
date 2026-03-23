"""
Comando para crear rutas de prueba
Ejecutar: python manage.py crear_rutas_prueba
"""
from django.core.management.base import BaseCommand
from pagina.models import Ruta


class Command(BaseCommand):
    help = 'Crea rutas de prueba: DR201, DR202, DR203, DR204'

    def handle(self, *args, **options):
        rutas_prueba = [
            {
                'codigo': 'DR201',
                'nombre': 'Ruta DR201',
                'descripcion': 'Ruta de distribución DR201',
                'activa': True,
            },
            {
                'codigo': 'DR202',
                'nombre': 'Ruta DR202',
                'descripcion': 'Ruta de distribución DR202',
                'activa': True,
            },
            {
                'codigo': 'DR203',
                'nombre': 'Ruta DR203',
                'descripcion': 'Ruta de distribución DR203',
                'activa': True,
            },
            {
                'codigo': 'DR204',
                'nombre': 'Ruta DR204',
                'descripcion': 'Ruta de distribución DR204',
                'activa': True,
            },
        ]
        
        creados = 0
        actualizados = 0
        
        for ruta_data in rutas_prueba:
            ruta, created = Ruta.objects.update_or_create(
                codigo=ruta_data['codigo'],
                defaults=ruta_data
            )
            
            if created:
                creados += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'[OK] Creada ruta: {ruta.codigo} - {ruta.nombre}'
                    )
                )
            else:
                actualizados += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'[ACTUALIZADO] Ruta: {ruta.codigo} - {ruta.nombre}'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n[OK] Proceso completado: {creados} creadas, {actualizados} actualizadas'
            )
        )




