// Funcionalidad del sidebar y navegación
document.addEventListener('DOMContentLoaded', function() {
    const sidebarNavLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mainContent = document.querySelector('.main-content');
    
    // Funcionalidad del botón hamburguesa
    if (hamburgerBtn && sidebar) {
        const hamburgerIcon = hamburgerBtn.querySelector('.hamburger-icon');
        const closeIcon = hamburgerBtn.querySelector('.close-icon');
        
        hamburgerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            sidebar.classList.toggle('show');
            hamburgerBtn.classList.toggle('active');
            sidebarOverlay.classList.toggle('show');
            
            // Cambiar iconos
            if (hamburgerBtn.classList.contains('active')) {
                hamburgerIcon.style.display = 'none';
                closeIcon.style.display = 'inline-block';
            } else {
                hamburgerIcon.style.display = 'inline-block';
                closeIcon.style.display = 'none';
            }
            
            // El sidebar es overlay, no afecta el ancho del contenido
            // La clase sidebar-open se mantiene para compatibilidad pero no afecta el layout
        });
        
        // Cerrar sidebar al hacer clic en el overlay
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('show');
            hamburgerBtn.classList.remove('active');
            sidebarOverlay.classList.remove('show');
            // El sidebar es overlay, no afecta el ancho del contenido
            hamburgerIcon.style.display = 'inline-block';
            closeIcon.style.display = 'none';
        });
        
        // Cerrar sidebar al hacer clic en un enlace del sidebar
        sidebarNavLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('show');
                    hamburgerBtn.classList.remove('active');
                    sidebarOverlay.classList.remove('show');
                    hamburgerIcon.style.display = 'inline-block';
                    closeIcon.style.display = 'none';
                }
            });
        });
    }
    
    // Resaltar el enlace activo según la URL actual (sidebar)
    const currentPath = window.location.pathname;
    sidebarNavLinks.forEach(link => {
        const linkPath = new URL(link.href).pathname;
        if (linkPath === currentPath || (currentPath === '/' && linkPath === '/')) {
            link.classList.add('active');
        }
    });
    
    // Ajustar padding del body cuando el tooltip del usuario está visible
    const userTooltipWrapper = document.querySelector('.user-icon-tooltip-wrapper');
    const userTooltip = document.querySelector('.user-tooltip');
    const body = document.body;
    
    if (userTooltipWrapper && userTooltip) {
        function updateBodyPadding() {
            if (userTooltip.style.visibility === 'visible' || userTooltipWrapper.matches(':hover')) {
                const tooltipHeight = userTooltip.offsetHeight;
                body.style.paddingTop = (56 + tooltipHeight) + 'px';
            } else {
                body.style.paddingTop = '56px';
            }
        }
        
        userTooltipWrapper.addEventListener('mouseenter', function() {
            setTimeout(updateBodyPadding, 50);
        });
        
        userTooltipWrapper.addEventListener('mouseleave', function() {
            setTimeout(updateBodyPadding, 50);
        });
        
        // Ajustar al redimensionar
        window.addEventListener('resize', updateBodyPadding);
    }
});

