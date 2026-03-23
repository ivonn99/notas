from django import template
from datetime import date

register = template.Library()

@register.filter
def diferencia_dias(fecha_corriente, fecha_nota):
    """Calcula la diferencia en días entre fecha_corriente y fecha_nota (valor absoluto)"""
    if not fecha_corriente or not fecha_nota:
        return 0
    diferencia = (fecha_corriente - fecha_nota).days
    return abs(diferencia)  # Retornar valor absoluto

@register.filter
def abs_value(value):
    """Retorna el valor absoluto de un número"""
    try:
        num = int(value)
        return num if num >= 0 else -num
    except (ValueError, TypeError):
        try:
            num = float(value)
            return num if num >= 0 else -num
        except (ValueError, TypeError):
            return 0

