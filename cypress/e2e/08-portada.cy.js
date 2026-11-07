// Portada (#/inicio) y modo desarrollador.
// Necesita el servidor y MySQL encendidos. Se ejecuta en localhost, donde el modo desarrollador está activo.

const { crearUsuario, eliminarUsuario } = require('../support/api');

describe('Portada y modo desarrollador', () => {
    let usuario;

    after(() => {
        if (usuario) eliminarUsuario(usuario);
    });

    it('sin sesión, la raíz muestra la portada', () => {
        cy.visit('/');
        cy.location('hash').should('eq', '#/inicio');
        cy.get('[data-testid=hero-empezar]').should('be.visible').and('have.attr', 'href', '#/registro');
    });

    it('el enlace "Resumen del mes" baja a esa sección sin salir de la portada', () => {
        cy.visit('/#/inicio');
        cy.get('[data-testid=landing-nav-resumen]').should('have.text', 'Resumen del mes').click();

        cy.location('hash').should('eq', '#/inicio?seccion=resumen-del-mes');
        cy.get('#resumen-del-mes').should('be.visible').and('contain.text', 'Ejemplo');
        cy.window().its('scrollY').should('be.greaterThan', 0);
        cy.get('[data-testid=hero-empezar]').should('exist'); // sigue en la misma página
    });

    it('en localhost aparece "Herramientas: Caché" y abre la pantalla del caché', () => {
        crearUsuario('portada').then((creado) => {
            usuario = creado;

            cy.visit('/#/panel', {
                onBeforeLoad(ventana) {
                    ventana.localStorage.setItem('financontrol.token', creado.token);
                }
            });
        });

        // "Caché" ya no está en el menú principal, sino al pie del menú lateral.
        cy.get('.lateral nav [data-testid=nav-cache]').should('not.exist');
        cy.get('[data-testid=nav-cache]').should('contain.text', 'Herramientas: Caché').click();

        cy.location('hash').should('eq', '#/cache');
        cy.get('[data-testid=cache-activo]').should('be.visible');
        cy.get('[data-testid=cache-pastilla]').should('contain.text', 'Caché:');
    });
});
