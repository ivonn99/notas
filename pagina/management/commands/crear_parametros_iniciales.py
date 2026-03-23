"""
Comando para crear los parámetros iniciales del sistema
Ejecutar: python manage.py crear_parametros_iniciales
"""
from django.core.management.base import BaseCommand
from pagina.models import Parametro


class Command(BaseCommand):
    help = 'Crea los parámetros iniciales del sistema'

    def handle(self, *args, **options):
        parametros_iniciales = [
            {
                'clave': 'dias_alerta_antiguedad',
                'valor': '30',
                'descripcion': 'Días para considerar una nota como antigua'
            },
            {
                'clave': 'dias_alerta_reaparicion',
                'valor': '7',
                'descripcion': 'Días desde aclaración para alertar reaparición'
            },
        ]
        
        creados = 0
        actualizados = 0
        
        for param_data in parametros_iniciales:
            parametro, created = Parametro.objects.update_or_create(
                clave=param_data['clave'],
                defaults={
                    'valor': param_data['valor'],
                    'descripcion': param_data['descripcion']
                }
            )
            
            if created:
                creados += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'[OK] Creado parametro: {param_data["clave"]} = {param_data["valor"]}'
                    )
                )
            else:
                actualizados += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'[ACTUALIZADO] Actualizado parametro: {param_data["clave"]} = {param_data["valor"]}'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n[OK] Proceso completado: {creados} creados, {actualizados} actualizados'
            )
        )

