// Interfaz web: flujo completo en el navegador (registro, ingresos, gastos, saldo y salida).
// Necesita el servidor y MySQL encendidos, igual que el resto de las pruebas.

describe('Interfaz web', () => {
    const correo = `qa.ui.${Date.now()}.${Math.floor(Math.random() * 1e6)}@financontrol.test`;
    const password = 'Clave-Interfaz-1';

    // Limpieza: elimina el usuario de prueba y sus datos
    after(() => {
        cy.request({ method: 'POST', url: '/api/usuarios/login', body: { correo, password }, failOnStatusCode: false }).then((login) => {
            if (login.status === 200) {
                cy.request({
                    method: 'DELETE',
                    url: '/api/usuarios/cuenta',
                    headers: { Authorization: `Bearer ${login.body.token}` },
                    body: { password },
                    failOnStatusCode: false
                });
            }
        });
    });

    it('sin sesión, las pantallas protegidas llevan al acceso', () => {
        cy.visit('/#/gastos');
        cy.location('hash').should('eq', '#/login');
        cy.get('[data-testid=auth-enviar]').should('be.visible');
    });

    it('valida el formulario de registro antes de enviarlo', () => {
        cy.visit('/#/registro');
        cy.get('[data-testid=auth-enviar]').click();
        cy.get('[data-testid=auth-error]').should('be.visible').and('contain.text', 'nombre');
    });

    it('permite registrarse, crear un ingreso y un gasto, ver el saldo y cerrar sesión', () => {
        cy.visit('/');
        cy.location('hash').should('eq', '#/inicio');
        cy.get('[data-testid=hero-empezar]').click();
        cy.location('hash').should('eq', '#/registro');

        // Registro (entra directo al panel)
        cy.get('[data-testid=tab-registro]').click();
        cy.get('[data-testid=f-nombre]').type('Usuario UI');
        cy.get('[data-testid=f-correo]').type(correo);
        cy.get('[data-testid=f-password]').type(password);
        cy.get('[data-testid=auth-enviar]').click();

        cy.location('hash').should('eq', '#/panel');
        cy.get('[data-testid=usuario-nombre]').should('have.text', 'Usuario UI');

        // Ingreso
        cy.get('[data-testid=nav-ingresos]').click();
        cy.get('[data-testid=btn-nuevo]').click();
        cy.get('[data-testid=f-descripcion]').type('Salario UI');
        cy.get('[data-testid=f-valor]').type('2500000');
        cy.get('[data-testid=f-guardar]').click();
        cy.get('[data-testid=fila]').should('have.length', 1).and('contain.text', 'Salario UI');

        // Gasto
        cy.get('[data-testid=nav-gastos]').click();
        cy.get('[data-testid=btn-nuevo]').click();
        cy.get('[data-testid=f-descripcion]').type('Mercado UI');
        cy.get('[data-testid=f-valor]').type('400000');
        cy.get('[data-testid=f-categoria]').type('Alimentación');
        cy.get('[data-testid=f-guardar]').click();
        cy.get('[data-testid=fila]').should('have.length', 1).and('contain.text', 'Mercado UI');

        // Saldo = 2.500.000 - 400.000 (se comparan solo los dígitos para no depender del formato regional)
        cy.get('[data-testid=nav-panel]').click();
        cy.get('[data-testid=saldo-valor]').should(($saldo) => {
            expect($saldo.text().replace(/\D/g, '')).to.eq('2100000');
        });
        cy.get('[data-testid=cache-pastilla]').should('contain.text', 'Caché:');

        // Cerrar sesión
        cy.get('[data-testid=cerrar-sesion]').click();
        cy.location('hash').should('eq', '#/login');
        cy.visit('/#/panel');
        cy.location('hash').should('eq', '#/login');
    });

    it('rechaza un inicio de sesión con contraseña incorrecta', () => {
        cy.visit('/#/login');
        cy.get('[data-testid=f-correo]').type(correo);
        cy.get('[data-testid=f-password]').type('incorrecta');
        cy.get('[data-testid=auth-enviar]').click();
        cy.get('[data-testid=auth-error]').should('be.visible').and('contain.text', 'incorrectos');
    });
});
