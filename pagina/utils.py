"""
Utilidades para el procesamiento de archivos de importación
"""
import csv
import pandas as pd
from io import StringIO, BytesIO
from decimal import Decimal, InvalidOperation
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def detectar_formato(archivo):
    """Detectar el formato del archivo basado en su extensión"""
    nombre = archivo.name.lower()
    if nombre.endswith('.csv'):
        return 'csv'
    elif nombre.endswith('.tsv'):
        return 'tsv'
    elif nombre.endswith('.xlsx') or nombre.endswith('.xls'):
        return 'excel'
    return None


def leer_archivo_csv(archivo, delimitador=','):
    """Leer archivo CSV o TSV"""
    try:
        # Leer el contenido del archivo
        contenido = archivo.read()
        if isinstance(contenido, bytes):
            contenido = contenido.decode('utf-8-sig')  # Manejar BOM
        
        # Crear un StringIO para leer como CSV
        archivo_io = StringIO(contenido)
        reader = csv.DictReader(archivo_io, delimiter=delimitador)
        
        # Convertir a lista de diccionarios
        datos = list(reader)
        return datos
    except Exception as e:
        logger.error(f"Error al leer archivo CSV/TSV: {str(e)}")
        raise ValueError(f"Error al leer el archivo: {str(e)}")


def leer_archivo_excel(archivo):
    """Leer archivo Excel"""
    try:
        # Leer el archivo Excel
        df = pd.read_excel(archivo, engine='openpyxl')
        
        # Convertir a lista de diccionarios
        datos = df.to_dict('records')
        return datos
    except Exception as e:
        logger.error(f"Error al leer archivo Excel: {str(e)}")
        raise ValueError(f"Error al leer el archivo Excel: {str(e)}")


def normalizar_nombre_columna(nombre):
    """Normalizar nombres de columnas (minúsculas, sin espacios, maneja /)"""
    if not nombre:
        return None
    return str(nombre).strip().lower().replace(' ', '_').replace('-', '_').replace('/', '_')


def mapear_columnas(datos, mapeo_columnas):
    """
    Mapear columnas del archivo a los campos del modelo
    mapeo_columnas: dict con formato {'campo_modelo': ['posibles_nombres_columna']}
    """
    if not datos:
        return []
    
    # Obtener la primera fila para identificar columnas
    primera_fila = datos[0]
    columnas_disponibles = [normalizar_nombre_columna(col) for col in primera_fila.keys()]
    
    # Crear mapeo real
    mapeo_real = {}
    for campo_modelo, posibles_nombres in mapeo_columnas.items():
        for nombre_col in posibles_nombres:
            nombre_normalizado = normalizar_nombre_columna(nombre_col)
            if nombre_normalizado in columnas_disponibles:
                # Encontrar la columna original (con el nombre exacto)
                for col_original in primera_fila.keys():
                    if normalizar_nombre_columna(col_original) == nombre_normalizado:
                        mapeo_real[campo_modelo] = col_original
                        break
                break
    
    return mapeo_real


def procesar_datos(datos, mapeo_columnas):
    """
    Procesar datos del archivo usando el mapeo de columnas
    Retorna lista de diccionarios con los datos normalizados
    """
    mapeo_real = mapear_columnas(datos, mapeo_columnas)
    
    if not mapeo_real:
        raise ValueError("No se pudieron mapear las columnas del archivo")
    
    registros_procesados = []
    errores = []
    
    for idx, fila in enumerate(datos, start=2):  # Empezar en 2 porque la fila 1 es el encabezado
        try:
            registro = {}
            
            # Extraer valores usando el mapeo
            for campo_modelo, columna_archivo in mapeo_real.items():
                valor = fila.get(columna_archivo, '')
                if valor is None:
                    valor = ''
                registro[campo_modelo] = str(valor).strip() if valor else ''
            
            registros_procesados.append(registro)
        except Exception as e:
            errores.append(f"Fila {idx}: {str(e)}")
            logger.error(f"Error procesando fila {idx}: {str(e)}")
    
    return registros_procesados, errores


def convertir_fecha(fecha_str, formatos=['%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d']):
    """Convertir string de fecha a objeto date"""
    if not fecha_str:
        return None
    
    fecha_str = str(fecha_str).strip()
    
    # Intentar parsear con pandas si es posible
    try:
        fecha = pd.to_datetime(fecha_str)
        return fecha.date()
    except:
        pass
    
    # Intentar formatos manuales
    for formato in formatos:
        try:
            return datetime.strptime(fecha_str, formato).date()
        except:
            continue
    
    raise ValueError(f"No se pudo convertir la fecha: {fecha_str}")


def convertir_decimal(valor_str):
    """Convertir string a Decimal"""
    if not valor_str or str(valor_str).strip() == '':
        return Decimal('0.00')
    
    try:
        # Remover caracteres no numéricos excepto punto y coma
        valor_limpio = str(valor_str).replace(',', '').replace('$', '').replace(' ', '').strip()
        return Decimal(valor_limpio)
    except (InvalidOperation, ValueError) as e:
        logger.error(f"Error convirtiendo a decimal: {valor_str} - {str(e)}")
        return Decimal('0.00')

