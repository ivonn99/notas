"""
Decoradores para control de acceso por roles
"""
from functools import wraps
from django.shortcuts import redirect
from django.contrib.auth.decorators import login_required


def rol_requerido(*roles_permitidos):
    """
    Decorador que verifica que el usuario tenga uno de los roles permitidos
    
    Uso:
        @rol_requerido('ADMIN', 'CREDITO')
        def mi_vista(request):
            ...
    """
    def decorator(view_func):
        @wraps(view_func)
        @login_required
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect('login')
            
            # Si es superusuario, tiene acceso a todo
            if request.user.is_superuser:
                return view_func(request, *args, **kwargs)
            
            # Verificar rol
            if request.user.rol not in roles_permitidos:
                # Redirigir a página principal con mensaje de error
                from django.contrib import messages
                messages.error(request, 'No tienes permisos para acceder a esta página.')
                return redirect('pagina_principal')
            
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator




