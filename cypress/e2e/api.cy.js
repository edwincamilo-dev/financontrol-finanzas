describe('API FinanControl', () => {
  const correo = `qa_${Date.now()}@example.com`
  const password = 'ClaveDePrueba123!'

  describe('Validaciones (no necesitan base de datos)', () => {
    it('registro sin campos devuelve 400', () => {
      cy.request({
        method: 'POST',
        url: '/api/usuarios/registro',
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.mensaje).to.eq('Todos los campos son obligatorios')
      })
    })

    it('login sin campos devuelve 400', () => {
      cy.request({
        method: 'POST',
        url: '/api/usuarios/login',
        body: {},
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.mensaje).to.eq('Correo y contraseña son obligatorios')
      })
    })

    it('una ruta protegida sin token es rechazada', () => {
      cy.request({
        method: 'GET',
        url: '/api/ingresos',
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401)
      })
    })
  })

  describe('Flujo completo (requiere base de datos)', () => {
    let token

    before(() => {
      cy.request('POST', '/api/usuarios/registro', {
        nombre: 'Usuario QA',
        correo,
        password,
      })
      cy.request('POST', '/api/usuarios/login', { correo, password }).then(
        (response) => {
          token = response.body.token
        }
      )
    })

    // Limpieza: elimina el usuario de prueba (y sus datos) al terminar
    after(() => {
      cy.request({
        method: 'DELETE',
        url: '/api/usuarios/cuenta',
        headers: { Authorization: `Bearer ${token}` },
        body: { password },
        failOnStatusCode: false,
      })
    })

    it('la API y la base de datos responden', () => {
      cy.request('/').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.baseDatos).to.eq('Conectada')
      })
    })

    it('login con contraseña incorrecta devuelve 401', () => {
      cy.request({
        method: 'POST',
        url: '/api/usuarios/login',
        body: { correo, password: 'incorrecta' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(401)
      })
    })

    it('rechaza un ingreso con valor 0', () => {
      cy.request({
        method: 'POST',
        url: '/api/ingresos',
        headers: { Authorization: `Bearer ${token}` },
        body: { descripcion: 'Inválido', valor: 0, fecha: '2026-10-16' },
        failOnStatusCode: false,
      }).then((response) => {
        expect(response.status).to.eq(400)
        expect(response.body.mensaje).to.eq('El valor debe ser mayor que 0')
      })
    })

    it('crea, consulta y elimina un ingreso', () => {
      cy.request({
        method: 'POST',
        url: '/api/ingresos',
        headers: { Authorization: `Bearer ${token}` },
        body: { descripcion: 'Salario', valor: 150000, fecha: '2026-10-16' },
      }).then((crear) => {
        expect(crear.status).to.eq(201)
        const id = crear.body.id

        cy.request({
          url: `/api/ingresos/${id}`,
          headers: { Authorization: `Bearer ${token}` },
        }).then((consulta) => {
          expect(consulta.body.descripcion).to.eq('Salario')
          expect(Number(consulta.body.valor)).to.eq(150000)
        })

        cy.request({
          method: 'DELETE',
          url: `/api/ingresos/${id}`,
          headers: { Authorization: `Bearer ${token}` },
        }).then((borrar) => {
          expect(borrar.status).to.eq(200)
        })
      })
    })
  })
})