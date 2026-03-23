from django.urls import path
from . import views

urlpatterns = [
    # Autenticación
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    
    # Dashboard
    path('', views.pagina_principal, name='pagina_principal'),
    
    # NOTAS DE CRÉDITO
    path('notas-credito/', views.todas_las_notas, name='todas_las_notas'),
    path('historial-importaciones/', views.historial_importaciones, name='historial_importaciones'),
    
    # CRÉDITO Y COBRANZA
    path('alertas/', views.alertas, name='alertas'),
    path('seguimiento/', views.seguimiento, name='seguimiento'),
    path('seguimiento/nota/<int:nota_id>/', views.detalle_nota, name='detalle_nota'),
    
    # CONFIGURACIÓN
    path('importar-reporte/', views.importar_reporte, name='importar_reporte'),
    path('importar-reporte/descargar-muestra/', views.descargar_archivo_muestra, name='descargar_archivo_muestra'),
    path('importar-reporte/ultimas-importaciones/', views.ultimas_importaciones_ajax, name='ultimas_importaciones_ajax'),
    path('importar-reporte/progreso/', views.importacion_progreso_ajax, name='importacion_progreso_ajax'),
    path('usuarios/', views.usuarios, name='usuarios'),
    path('usuarios/editar/<int:usuario_id>/', views.editar_usuario, name='editar_usuario'),
    path('usuarios/asignar-rutas/<int:usuario_id>/', views.asignar_rutas_usuario, name='asignar_rutas_usuario'),
    path('rutas/', views.rutas, name='rutas'),
    path('rutas/editar/<int:ruta_id>/', views.editar_ruta, name='editar_ruta'),
    path('parametros/', views.parametros, name='parametros'),
    path('parametros/editar/<int:parametro_id>/', views.editar_parametro, name='editar_parametro'),
    path('logs-sistema/', views.logs_sistema, name='logs_sistema'),
    
    # MI CUENTA
    path('perfil/', views.perfil, name='perfil'),
    path('notificaciones/', views.notificaciones, name='notificaciones'),
]
