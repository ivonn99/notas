"""
Modelos para el sistema de gestión de notas de crédito
"""
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from decimal import Decimal


class Usuario(AbstractUser):
    """
    Modelo de usuario personalizado que extiende AbstractUser
    Incluye campos adicionales para roles y estado
    """
    ROL_CHOICES = [
        ('VENDEDOR', 'Vendedor'),
        ('CREDITO', 'Crédito y Cobranza'),
        ('ADMIN', 'Administrador'),
    ]
    
    nombre_completo = models.CharField(max_length=200, verbose_name='Nombre Completo')
    rol = models.CharField(
        max_length=20,
        choices=ROL_CHOICES,
        default='VENDEDOR',
        verbose_name='Rol'
    )
    activo = models.BooleanField(default=True, verbose_name='Activo')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Creación')
    
    # Relación Many-to-Many con Rutas
    rutas = models.ManyToManyField('Ruta', through='UsuarioRuta', related_name='usuarios')
    
    class Meta:
        db_table = 'usuarios'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'
        ordering = ['username']
    
    def __str__(self):
        return f"{self.username} ({self.get_rol_display()})"


class Ruta(models.Model):
    """
    Modelo para las rutas de distribución
    """
    codigo = models.CharField(max_length=50, unique=True, verbose_name='Código')
    nombre = models.CharField(max_length=200, verbose_name='Nombre')
    descripcion = models.TextField(blank=True, null=True, verbose_name='Descripción')
    activa = models.BooleanField(default=True, verbose_name='Activa')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Creación')
    
    class Meta:
        db_table = 'rutas'
        verbose_name = 'Ruta'
        verbose_name_plural = 'Rutas'
        ordering = ['codigo']
    
    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class UsuarioRuta(models.Model):
    """
    Tabla intermedia para la relación Many-to-Many entre Usuario y Ruta
    """
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, db_column='usuario_id')
    ruta = models.ForeignKey(Ruta, on_delete=models.CASCADE, db_column='ruta_id')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Creación')
    
    class Meta:
        db_table = 'usuario_rutas'
        verbose_name = 'Usuario-Ruta'
        verbose_name_plural = 'Usuarios-Rutas'
        unique_together = [['usuario', 'ruta']]
        indexes = [
            models.Index(fields=['usuario', 'ruta']),
        ]
    
    def __str__(self):
        return f"{self.usuario.username} - {self.ruta.codigo}"


class NotaCredito(models.Model):
    """
    Modelo principal para las notas de crédito
    """
    ESTADO_CHOICES = [
        ('PENDIENTE', 'Pendiente'),
        ('RESUELTA', 'Resuelta'),
        ('CANCELADA', 'Cancelada'),
    ]
    
    EMPRESA_CHOICES = [
        ('DISTRIBUIDORA', 'Distribuidora'),
        ('RODRIGO', 'Rodrigo'),
    ]
    
    serie_folio = models.CharField(max_length=100, verbose_name='Serie-Folio')
    fecha_nota = models.DateField(verbose_name='Fecha de la Nota')
    cliente = models.CharField(max_length=200, verbose_name='Cliente')
    empresa = models.CharField(
        max_length=200,
        choices=EMPRESA_CHOICES,
        verbose_name='Empresa',
        help_text='Solo puede ser DISTRIBUIDORA o RODRIGO',
        default='DISTRIBUIDORA'
    )
    ruta = models.ForeignKey(Ruta, on_delete=models.PROTECT, db_column='ruta_id', verbose_name='Ruta')
    usuario = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='usuario_id',
        verbose_name='Vendedor Asignado'
    )
    usuario_vendedor_pv = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        verbose_name='Usuario/Vendedor (Punto de Venta)',
        help_text='Valor interno del punto de venta (ej: PERSONA_1, PERSONA_2). No tiene relación con usuario_id.'
    )
    monto = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.01'))],
        verbose_name='Monto'
    )
    abono = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name='Abono'
    )
    saldo = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        verbose_name='Saldo'
    )
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='PENDIENTE',
        verbose_name='Estado'
    )
    resuelta_automaticamente = models.BooleanField(default=False, verbose_name='Resuelta Automáticamente')
    requiere_atencion = models.BooleanField(
        default=False,
        verbose_name='Requiere Atención',
        help_text='Indica si la nota tiene comentarios o información pendiente de revisar'
    )
    fecha_corriente = models.DateField(verbose_name='Fecha Corriente')
    fecha_ultima_actualizacion = models.DateTimeField(auto_now=True, verbose_name='Última Actualización')
    fecha_resolucion = models.DateTimeField(null=True, blank=True, verbose_name='Fecha de Resolución')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha de Registro')
    
    class Meta:
        db_table = 'notas_credito'
        verbose_name = 'Nota de Crédito'
        verbose_name_plural = 'Notas de Crédito'
        ordering = ['-fecha_nota', 'serie_folio']
        unique_together = [['empresa', 'serie_folio']]
        indexes = [
            models.Index(fields=['serie_folio'], name='idx_notas_serie_folio'),
            models.Index(fields=['empresa', 'serie_folio'], name='idx_notas_empresa_serie'),
            models.Index(fields=['ruta'], name='idx_notas_ruta'),
            models.Index(fields=['usuario'], name='idx_notas_usuario'),
            models.Index(fields=['estado'], name='idx_notas_estado'),
            models.Index(fields=['fecha_nota'], name='idx_notas_fecha'),
        ]
    
    def __str__(self):
        return f"{self.serie_folio} - {self.cliente} ({self.get_estado_display()})"
    
    def save(self, *args, **kwargs):
        # Calcular saldo automáticamente
        self.saldo = self.monto - self.abono
        super().save(*args, **kwargs)


class HistorialNota(models.Model):
    """
    Modelo para el tracking de cambios en las notas de crédito
    """
    nota = models.ForeignKey(
        NotaCredito,
        on_delete=models.CASCADE,
        db_column='nota_id',
        related_name='historial',
        verbose_name='Nota de Crédito'
    )
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT, db_column='usuario_id', verbose_name='Usuario')
    campo_modificado = models.CharField(max_length=100, verbose_name='Campo Modificado')
    valor_anterior = models.TextField(null=True, blank=True, verbose_name='Valor Anterior')
    valor_nuevo = models.TextField(null=True, blank=True, verbose_name='Valor Nuevo')
    observacion = models.TextField(blank=True, null=True, verbose_name='Observación')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha')
    
    class Meta:
        db_table = 'historial_notas'
        verbose_name = 'Historial de Nota'
        verbose_name_plural = 'Historial de Notas'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['nota'], name='idx_historial_nota'),
        ]
    
    def __str__(self):
        return f"{self.nota.serie_folio} - {self.campo_modificado} ({self.created_at})"


class Aclaracion(models.Model):
    """
    Modelo para comentarios y seguimiento de notas
    """
    TIPO_CHOICES = [
        ('COMENTARIO', 'Comentario'),
        ('ACLARACION', 'Aclaración'),
        ('SEGUIMIENTO', 'Seguimiento'),
    ]
    
    nota = models.ForeignKey(
        NotaCredito,
        on_delete=models.CASCADE,
        db_column='nota_id',
        related_name='aclaraciones',
        verbose_name='Nota de Crédito'
    )
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT, db_column='usuario_id', verbose_name='Usuario')
    comentario = models.TextField(verbose_name='Comentario')
    tipo = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default='COMENTARIO',
        verbose_name='Tipo'
    )
    leida = models.BooleanField(default=False, verbose_name='Leída', help_text='Indica si el comentario ha sido visto por crédito/cobranza')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha')
    
    class Meta:
        db_table = 'aclaraciones'
        verbose_name = 'Aclaración'
        verbose_name_plural = 'Aclaraciones'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['nota'], name='idx_aclaraciones_nota'),
        ]
    
    def __str__(self):
        return f"{self.nota.serie_folio} - {self.get_tipo_display()} ({self.created_at})"


class Documento(models.Model):
    """
    Modelo para evidencias/documentos adjuntos a las notas
    """
    nota = models.ForeignKey(
        NotaCredito,
        on_delete=models.CASCADE,
        db_column='nota_id',
        related_name='documentos',
        verbose_name='Nota de Crédito'
    )
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT, db_column='usuario_id', verbose_name='Usuario')
    nombre_archivo = models.CharField(max_length=255, verbose_name='Nombre del Archivo')
    ruta_archivo = models.CharField(max_length=500, verbose_name='Ruta del Archivo')
    tipo_mime = models.CharField(max_length=100, blank=True, null=True, verbose_name='Tipo MIME')
    tamanio = models.IntegerField(null=True, blank=True, verbose_name='Tamaño (bytes)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha')
    
    class Meta:
        db_table = 'documentos'
        verbose_name = 'Documento'
        verbose_name_plural = 'Documentos'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.nota.serie_folio} - {self.nombre_archivo}"


class Alerta(models.Model):
    """
    Modelo para notificaciones y alertas del sistema
    """
    TIPO_CHOICES = [
        ('REAPARICION', 'Reaparición'),
        ('ANTIGUA', 'Antigua'),
        ('DISCREPANCIA', 'Discrepancia'),
        ('CAMBIO_RUTA', 'Cambio de Ruta'),
        ('NUEVO_COMENTARIO', 'Nuevo Comentario'),
    ]
    
    nota = models.ForeignKey(
        NotaCredito,
        on_delete=models.CASCADE,
        db_column='nota_id',
        related_name='alertas',
        verbose_name='Nota de Crédito'
    )
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, verbose_name='Tipo de Alerta')
    descripcion = models.TextField(verbose_name='Descripción')
    leida = models.BooleanField(default=False, verbose_name='Leída')
    usuario_asignado = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='usuario_asignado_id',
        related_name='alertas_asignadas',
        verbose_name='Usuario Asignado'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha')
    
    class Meta:
        db_table = 'alertas'
        verbose_name = 'Alerta'
        verbose_name_plural = 'Alertas'
        ordering = ['-created_at', 'leida']
        indexes = [
            models.Index(fields=['leida'], name='idx_alertas_leida'),
        ]
    
    def __str__(self):
        return f"{self.get_tipo_display()} - {self.nota.serie_folio}"


class Importacion(models.Model):
    """
    Modelo para el log de importaciones CSV
    """
    ESTADO_CHOICES = [
        ('COMPLETADA', 'Completada'),
        ('FALLIDA', 'Fallida'),
        ('PARCIAL', 'Parcial'),
    ]
    
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT, db_column='usuario_id', verbose_name='Usuario')
    nombre_archivo = models.CharField(max_length=255, verbose_name='Nombre del Archivo')
    total_registros = models.IntegerField(verbose_name='Total de Registros')
    registros_nuevos = models.IntegerField(default=0, verbose_name='Registros Nuevos')
    registros_actualizados = models.IntegerField(default=0, verbose_name='Registros Actualizados')
    registros_resueltos = models.IntegerField(default=0, verbose_name='Registros Resueltos')
    estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='COMPLETADA',
        verbose_name='Estado'
    )
    observaciones = models.TextField(blank=True, null=True, verbose_name='Observaciones')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Fecha')
    
    class Meta:
        db_table = 'importaciones'
        verbose_name = 'Importación'
        verbose_name_plural = 'Importaciones'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.nombre_archivo} - {self.get_estado_display()} ({self.created_at})"


class Parametro(models.Model):
    """
    Modelo para parámetros de configuración del sistema
    """
    clave = models.CharField(max_length=100, unique=True, verbose_name='Clave')
    valor = models.TextField(verbose_name='Valor')
    descripcion = models.TextField(blank=True, null=True, verbose_name='Descripción')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Última Actualización')
    
    class Meta:
        db_table = 'parametros'
        verbose_name = 'Parámetro'
        verbose_name_plural = 'Parámetros'
        ordering = ['clave']
    
    def __str__(self):
        return f"{self.clave} = {self.valor}"

