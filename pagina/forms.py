"""
Formularios para el sistema de gestión de notas de crédito
"""
from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import Usuario, Ruta, Parametro


class UsuarioForm(UserCreationForm):
    """Formulario para crear y editar usuarios"""
    nombre_completo = forms.CharField(
        max_length=200,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Nombre completo del usuario'
        }),
        label='Nombre Completo'
    )
    
    email = forms.EmailField(
        required=True,
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'correo@ejemplo.com'
        }),
        label='Correo Electrónico'
    )
    
    rol = forms.ChoiceField(
        choices=Usuario.ROL_CHOICES,
        required=True,
        widget=forms.Select(attrs={
            'class': 'form-control'
        }),
        label='Rol'
    )
    
    activo = forms.BooleanField(
        required=False,
        initial=True,
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        }),
        label='Usuario Activo'
    )
    
    password1 = forms.CharField(
        label='Contraseña',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Mínimo 4 caracteres'
        }),
        help_text='La contraseña debe tener al menos 4 caracteres.',
        min_length=4
    )
    
    password2 = forms.CharField(
        label='Confirmar Contraseña',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Repite la contraseña'
        }),
        help_text='Ingresa la misma contraseña para verificación.'
    )
    
    class Meta:
        model = Usuario
        fields = ('username', 'email', 'nombre_completo', 'rol', 'activo', 'password1', 'password2')
        widgets = {
            'username': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Nombre de usuario único'
            }),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Si es edición, hacer que las contraseñas sean opcionales
        if self.instance and self.instance.pk:
            self.fields['password1'].required = False
            self.fields['password2'].required = False
            self.fields['password1'].help_text = 'Deja en blanco si no quieres cambiar la contraseña.'
            self.fields['password2'].help_text = 'Deja en blanco si no quieres cambiar la contraseña.'
    
    def clean_password2(self):
        """Validar que las contraseñas coincidan y tengan mínimo 4 caracteres"""
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        
        if password1 and password2:
            if password1 != password2:
                raise forms.ValidationError("Las contraseñas no coinciden.")
            if len(password1) < 4:
                raise forms.ValidationError("La contraseña debe tener al menos 4 caracteres.")
        
        return password2
    
    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data['email']
        user.nombre_completo = self.cleaned_data['nombre_completo']
        user.rol = self.cleaned_data['rol']
        user.activo = self.cleaned_data.get('activo', True)
        
        # Si es edición y no se proporcionó contraseña, mantener la actual
        if self.instance and self.instance.pk:
            if not self.cleaned_data.get('password1'):
                user.set_password(user.password)  # Mantener la contraseña actual
            else:
                user.set_password(self.cleaned_data['password1'])
        else:
            user.set_password(self.cleaned_data['password1'])
        
        if commit:
            user.save()
        return user


class UsuarioEditarForm(forms.ModelForm):
    """Formulario simplificado para editar usuarios (sin contraseña)"""
    password = forms.CharField(
        required=False,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Deja en blanco para mantener la contraseña actual'
        }),
        label='Nueva Contraseña (opcional)',
        help_text='Solo completa si deseas cambiar la contraseña.'
    )
    
    class Meta:
        model = Usuario
        fields = ('username', 'email', 'nombre_completo', 'rol', 'activo')
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'nombre_completo': forms.TextInput(attrs={'class': 'form-control'}),
            'rol': forms.Select(attrs={'class': 'form-control'}),
            'activo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
    
    def save(self, commit=True):
        user = super().save(commit=False)
        password = self.cleaned_data.get('password')
        if password:
            user.set_password(password)
        if commit:
            user.save()
        return user


class RutaForm(forms.ModelForm):
    """Formulario para crear y editar rutas"""
    
    class Meta:
        model = Ruta
        fields = ('codigo', 'nombre', 'descripcion', 'activa')
        widgets = {
            'codigo': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: RUTA-001'
            }),
            'nombre': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Nombre de la ruta'
            }),
            'descripcion': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Descripción de la ruta'
            }),
            'activa': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
        }
        labels = {
            'codigo': 'Código',
            'nombre': 'Nombre',
            'descripcion': 'Descripción',
            'activa': 'Ruta Activa',
        }
    
    def clean_codigo(self):
        """Validar que el código sea único"""
        codigo = self.cleaned_data.get('codigo')
        if codigo:
            codigo = codigo.upper().strip()
            # Si es edición, excluir el registro actual
            if self.instance and self.instance.pk:
                if Ruta.objects.filter(codigo=codigo).exclude(pk=self.instance.pk).exists():
                    raise forms.ValidationError('Este código ya está en uso.')
            else:
                if Ruta.objects.filter(codigo=codigo).exists():
                    raise forms.ValidationError('Este código ya está en uso.')
        return codigo


class AsignarRutasForm(forms.Form):
    """Formulario para asignar rutas a un usuario"""
    rutas = forms.ModelMultipleChoiceField(
        queryset=Ruta.objects.filter(activa=True).order_by('codigo'),
        widget=forms.CheckboxSelectMultiple(attrs={
            'class': 'form-check-input'
        }),
        required=False,
        label='Rutas',
        help_text='Selecciona las rutas que deseas asignar a este usuario.'
    )


class CambiarPasswordForm(forms.Form):
    """Formulario para cambiar contraseña del usuario"""
    password_actual = forms.CharField(
        label='Contraseña Actual',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ingresa tu contraseña actual'
        }),
        required=True,
        help_text='Necesitamos verificar tu identidad.'
    )
    
    password_nueva = forms.CharField(
        label='Nueva Contraseña',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Mínimo 4 caracteres'
        }),
        required=True,
        min_length=4,
        help_text='La contraseña debe tener al menos 4 caracteres.'
    )
    
    password_nueva_confirmar = forms.CharField(
        label='Confirmar Nueva Contraseña',
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Repite la nueva contraseña'
        }),
        required=True,
        help_text='Ingresa la misma contraseña para verificación.'
    )
    
    def __init__(self, user, *args, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)
    
    def clean_password_actual(self):
        """Verificar que la contraseña actual sea correcta"""
        password_actual = self.cleaned_data.get('password_actual')
        if not self.user.check_password(password_actual):
            raise forms.ValidationError('La contraseña actual es incorrecta.')
        return password_actual
    
    def clean_password_nueva_confirmar(self):
        """Verificar que las nuevas contraseñas coincidan"""
        password_nueva = self.cleaned_data.get('password_nueva')
        password_nueva_confirmar = self.cleaned_data.get('password_nueva_confirmar')
        
        if password_nueva and password_nueva_confirmar:
            if password_nueva != password_nueva_confirmar:
                raise forms.ValidationError('Las nuevas contraseñas no coinciden.')
            if len(password_nueva) < 4:
                raise forms.ValidationError('La nueva contraseña debe tener al menos 4 caracteres.')
        
        return password_nueva_confirmar
    
    def save(self):
        """Cambiar la contraseña del usuario"""
        password_nueva = self.cleaned_data['password_nueva']
        self.user.set_password(password_nueva)
        self.user.save()
        return self.user


class ParametroForm(forms.ModelForm):
    """Formulario para crear y editar parámetros"""
    
    class Meta:
        model = Parametro
        fields = ('clave', 'valor', 'descripcion')
        widgets = {
            'clave': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: dias_alerta_antiguedad'
            }),
            'valor': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 3,
                'placeholder': 'Valor del parámetro'
            }),
            'descripcion': forms.Textarea(attrs={
                'class': 'form-control',
                'rows': 2,
                'placeholder': 'Descripción del parámetro'
            }),
        }
        labels = {
            'clave': 'Clave',
            'valor': 'Valor',
            'descripcion': 'Descripción',
        }
        help_texts = {
            'clave': 'Nombre único del parámetro (sin espacios, usar guiones bajos)',
            'valor': 'Valor del parámetro (puede ser texto, número, etc.)',
            'descripcion': 'Descripción de qué hace este parámetro',
        }
    
    def clean_clave(self):
        """Validar formato de clave"""
        clave = self.cleaned_data.get('clave')
        if clave:
            clave = clave.strip()
            # Validar que no tenga espacios
            if ' ' in clave:
                raise forms.ValidationError('La clave no puede contener espacios. Usa guiones bajos (_) en su lugar.')
            # Si es edición, verificar que no exista otra con la misma clave
            if self.instance and self.instance.pk:
                if Parametro.objects.filter(clave=clave).exclude(pk=self.instance.pk).exists():
                    raise forms.ValidationError('Esta clave ya está en uso.')
            else:
                if Parametro.objects.filter(clave=clave).exists():
                    raise forms.ValidationError('Esta clave ya está en uso.')
        return clave


class ImportarReporteForm(forms.Form):
    """Formulario para importar reportes (CSV, TSV, Excel)"""
    archivo = forms.FileField(
        label='Archivo de Reporte',
        help_text='Formatos soportados: CSV, TSV, Excel (.xlsx, .xls)',
        widget=forms.FileInput(attrs={
            'class': 'form-control',
            'accept': '.csv,.tsv,.xlsx,.xls',
            'id': 'archivo-input'
        }),
        required=True
    )
    
    def clean_archivo(self):
        """Validar el archivo subido"""
        archivo = self.cleaned_data.get('archivo')
        if archivo:
            # Validar extensión
            nombre = archivo.name.lower()
            extensiones_validas = ['.csv', '.tsv', '.xlsx', '.xls']
            if not any(nombre.endswith(ext) for ext in extensiones_validas):
                raise forms.ValidationError(
                    'Formato de archivo no soportado. Use CSV, TSV o Excel (.xlsx, .xls)'
                )
            
            # Validar tamaño (máximo 50MB)
            if archivo.size > 50 * 1024 * 1024:
                raise forms.ValidationError('El archivo es demasiado grande. Máximo 50MB.')
        
        return archivo


class CambiarEstadoForm(forms.Form):
    """Formulario para cambiar el estado de una nota"""
    from .models import NotaCredito
    
    estado = forms.ChoiceField(
        choices=NotaCredito.ESTADO_CHOICES,
        required=True,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label='Nuevo Estado'
    )
    
    comentario = forms.CharField(
        required=True,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 4,
            'placeholder': 'Explica el motivo del cambio de estado...'
        }),
        label='Comentario',
        help_text='Este comentario se guardará en el historial de la nota.'
    )


class AgregarComentarioForm(forms.Form):
    """Formulario para agregar comentarios/aclaraciones a una nota"""
    from .models import Aclaracion
    
    comentario = forms.CharField(
        required=True,
        widget=forms.Textarea(attrs={
            'class': 'form-control',
            'rows': 4,
            'placeholder': 'Escribe tu comentario o aclaración...'
        }),
        label='Comentario'
    )
    
    tipo = forms.ChoiceField(
        choices=Aclaracion.TIPO_CHOICES,
        required=True,
        widget=forms.Select(attrs={
            'class': 'form-select'
        }),
        label='Tipo',
        initial='COMENTARIO'
    )

