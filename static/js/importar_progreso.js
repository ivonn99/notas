/**
 * Sistema de progreso real para importación de archivos
 * Utiliza polling para obtener el progreso actualizado del servidor
 */

class ImportarProgreso {
    constructor(modalElement, barraProgreso, textoProgreso, porcentajeActual, etapaActual, mensajeDetalle) {
        this.modal = modalElement;
        this.barraProgreso = barraProgreso;
        this.textoProgreso = textoProgreso;
        this.porcentajeActual = porcentajeActual;
        this.etapaActual = etapaActual;
        this.mensajeDetalle = mensajeDetalle;
        this.intervaloPolling = null;
        this.urlProgreso = null;
        this.importacionId = null;
    }

    /**
     * Iniciar el seguimiento del progreso
     * @param {string} urlProgreso - URL para obtener el progreso
     * @param {number} importacionId - ID de la importación (opcional)
     */
    iniciar(urlProgreso, importacionId = null) {
        console.log('[PROGRESO] Iniciando seguimiento de progreso real');
        this.urlProgreso = urlProgreso;
        this.importacionId = importacionId;
        
        // Mostrar modal
        if (this.modal) {
            const modalBootstrap = new bootstrap.Modal(this.modal);
            modalBootstrap.show();
        }
        
        // Iniciar polling cada 500ms
        this.intervaloPolling = setInterval(() => {
            this.obtenerProgreso();
        }, 500);
        
        // Primera consulta inmediata
        this.obtenerProgreso();
    }

    /**
     * Obtener el progreso actual del servidor
     */
    async obtenerProgreso() {
        if (!this.urlProgreso) {
            console.warn('[PROGRESO] URL de progreso no definida');
            return;
        }

        try {
            const url = this.importacionId 
                ? `${this.urlProgreso}?importacion_id=${this.importacionId}`
                : this.urlProgreso;
            
            console.log('[PROGRESO] Consultando progreso desde:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                console.error('[PROGRESO] Error en la respuesta:', response.status);
                return;
            }

            const data = await response.json();
            console.log('[PROGRESO] Datos recibidos:', data);

            // Actualizar la barra de progreso
            this.actualizar(data);

            // Si está completado o fallido, detener el polling
            if (data.completado || data.error) {
                this.detener();
                
                if (data.error) {
                    console.error('[PROGRESO] Error en la importación:', data.mensaje);
                } else {
                    console.log('[PROGRESO] Importación completada exitosamente');
                }
            }

        } catch (error) {
            console.error('[PROGRESO] Error al obtener progreso:', error);
        }
    }

    /**
     * Actualizar la barra de progreso con los datos recibidos
     * @param {Object} data - Datos del progreso
     */
    actualizar(data) {
        const porcentaje = data.porcentaje || 0;
        const etapa = data.etapa || 'Procesando...';
        const detalle = data.detalle || '';
        const registrosProcesados = data.registros_procesados || 0;
        const totalRegistros = data.total_registros || 0;

        // Actualizar barra de progreso
        if (this.barraProgreso) {
            this.barraProgreso.style.width = porcentaje + '%';
            this.barraProgreso.setAttribute('aria-valuenow', porcentaje);
        }

        // Actualizar texto del porcentaje
        if (this.textoProgreso) {
            this.textoProgreso.textContent = porcentaje + '%';
        }

        if (this.porcentajeActual) {
            this.porcentajeActual.textContent = porcentaje + '%';
        }

        // Actualizar etapa actual
        if (this.etapaActual) {
            this.etapaActual.textContent = etapa;
        }

        // Actualizar mensaje detallado
        if (this.mensajeDetalle) {
            let mensajeCompleto = detalle;
            if (totalRegistros > 0) {
                mensajeCompleto += ` (${registrosProcesados}/${totalRegistros} registros)`;
            }
            this.mensajeDetalle.textContent = mensajeCompleto;
        }

        console.log(`[PROGRESO] Actualizado: ${porcentaje}% - ${etapa}`);
    }

    /**
     * Detener el seguimiento del progreso
     */
    detener() {
        console.log('[PROGRESO] Deteniendo seguimiento de progreso');
        if (this.intervaloPolling) {
            clearInterval(this.intervaloPolling);
            this.intervaloPolling = null;
        }
    }

    /**
     * Ocultar el modal
     */
    ocultar() {
        if (this.modal) {
            const modalBootstrap = bootstrap.Modal.getInstance(this.modal);
            if (modalBootstrap) {
                modalBootstrap.hide();
            }
        }
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.ImportarProgreso = ImportarProgreso;
}




