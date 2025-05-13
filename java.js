// REGISTRO
function registrarUsuario(e) {
  e.preventDefault();
  const nombre = document.getElementById("nombre").value;
  const correo = document.getElementById("correo").value.toLowerCase();
  const password = document.getElementById("password").value;
  const rol = document.getElementById("rol").value;

  if (!rol) return alert("Debes seleccionar un tipo de usuario.");

  auth.createUserWithEmailAndPassword(correo, password)
    .then((cred) => db.collection("usuarios").doc(cred.user.uid).set({ nombre, correo, rol }))
    .then(() => {
      alert("Registro exitoso. Ahora puedes iniciar sesión.");
      window.location.href = "login.html";
    })
    .catch((error) => alert("Error en el registro: " + error.message));
}

// LOGIN
function iniciarSesion(e) {
  e.preventDefault();
  const correo = document.getElementById("correoLogin").value.toLowerCase();
  const password = document.getElementById("passwordLogin").value;

  auth.signInWithEmailAndPassword(correo, password)
    .then((cred) => db.collection("usuarios").doc(cred.user.uid).get())
    .then((doc) => {
      if (!doc.exists) throw new Error("No se encontró información adicional del usuario.");
      const usuario = doc.data();
      localStorage.setItem("usuarioActual", JSON.stringify(usuario));
      alert(`Bienvenido, ${usuario.nombre}`);
      window.location.href = usuario.rol === "distribuidor" ? "catalogo-b2b.html" : "catalogo.html";
    })
    .catch((error) => alert("Error al iniciar sesión: " + error.message));
}

// CARRITO
function agregarAlCarrito(nombre, precio, imagen) {
  auth.onAuthStateChanged(usuario => {
    if (!usuario) return alert("Debes iniciar sesión para agregar productos.");

    const producto = { nombre, precio, img: imagen };
    const ref = db.collection("carritos").doc(usuario.uid);

    ref.get().then(doc => {
      let productos = doc.exists ? doc.data().productos || [] : [];
      productos.push(producto);
      return ref.set({ productos });
    }).then(() => alert(`${nombre} fue agregado al carrito`))
      .catch(error => console.error("Error al agregar al carrito:", error));
  });
}

function mostrarCarrito() {
  auth.onAuthStateChanged(usuario => {
    if (!usuario) return;

    const contenedor = document.getElementById("carrito-contenido");
    const totalTexto = document.getElementById("total");

    if (!contenedor || !totalTexto) return;

    db.collection("carritos").doc(usuario.uid).get()
      .then(doc => {
        const carrito = doc.exists ? doc.data().productos || [] : [];

        if (carrito.length === 0) {
          contenedor.innerHTML = "<p>El carrito está vacío.</p>";
          totalTexto.textContent = "";
          return;
        }

        let total = 0;
        contenedor.innerHTML = "";
        carrito.forEach((p, i) => {
          contenedor.innerHTML += `
            <div class="producto">
              <img src="${p.img}" alt="${p.nombre}">
              <h3>${p.nombre}</h3>
              <p>$${p.precio.toLocaleString('es-CL')}</p>
              <button class="eliminar" onclick="eliminarProducto(${i})">Eliminar</button>
            </div>`;
          total += p.precio;
        });

        totalTexto.textContent = `Total: $${total.toLocaleString('es-CL')}`;
      });
  });
}

function eliminarProducto(indice) {
  auth.onAuthStateChanged(usuario => {
    if (!usuario) return;
    const ref = db.collection("carritos").doc(usuario.uid);

    ref.get().then(doc => {
      if (!doc.exists) return;
      let productos = doc.data().productos || [];
      productos.splice(indice, 1);
      return ref.set({ productos });
    }).then(() => mostrarCarrito());
  });
}

function vaciarCarrito() {
  auth.onAuthStateChanged(usuario => {
    if (!usuario) return;
    db.collection("carritos").doc(usuario.uid).set({ productos: [] }).then(mostrarCarrito);
  });
}

// PEDIDOS
function confirmarPedido() {
  auth.onAuthStateChanged(usuario => {
    if (!usuario) return alert("Debes iniciar sesión para confirmar un pedido.");

    const ref = db.collection("carritos").doc(usuario.uid);

    ref.get().then(doc => {
      const productos = doc.exists ? doc.data().productos || [] : [];
      if (productos.length === 0) return alert("Tu carrito está vacío.");

      const pedido = {
        fecha: new Date().toLocaleString(),
        productos,
        total: productos.reduce((s, p) => s + p.precio, 0)
      };

      return db.collection("pedidos").doc(usuario.uid).collection("historial").add(pedido)
        .then(() => db.collection("carritos").doc(usuario.uid).set({ productos: [] }))
        .then(() => {
          alert("¡Pedido confirmado!");
          mostrarCarrito();
          validarSesionParaCompra();
          const btnCuenta = document.getElementById("ver-cuenta");
          if (btnCuenta) btnCuenta.style.display = "block";
        });
    });
  });
}

// HISTORIAL
function mostrarHistorial() {
  auth.onAuthStateChanged(usuario => {
    if (!usuario) return;
    const contenedor = document.getElementById("historial");
    if (!contenedor) return;

    db.collection("pedidos").doc(usuario.uid).collection("historial")
      .orderBy("fecha", "desc")
      .get()
      .then(snapshot => {
        if (snapshot.empty) {
          contenedor.innerHTML = "<p>No hay pedidos registrados.</p>";
          return;
        }

        contenedor.innerHTML = "";
        snapshot.forEach(doc => {
          const pedido = doc.data();
          let html = `<div class="pedido"><p><strong>Fecha:</strong> ${pedido.fecha}</p><ul>`;
          pedido.productos.forEach(p => {
            html += `<li>${p.nombre} - $${p.precio.toLocaleString('es-CL')}</li>`;
          });
          html += `</ul><p><strong>Total:</strong> $${pedido.total.toLocaleString('es-CL')}</p></div><hr>`;
          contenedor.innerHTML += html;
        });
      });
  });
}

// USUARIO EN PÁGINA DE CUENTA
function mostrarUsuario() {
  auth.onAuthStateChanged(usuario => {
    const saludo = document.getElementById("saludo");
    if (!usuario || !saludo) return;

    db.collection("usuarios").doc(usuario.uid).get().then(doc => {
      if (doc.exists) saludo.textContent = "Bienvenido, " + doc.data().nombre;
    });
  });
}

// CIERRE DE SESIÓN
function cerrarSesion() {
  auth.signOut().then(() => {
    localStorage.removeItem("usuarioActual");
    alert("Sesión cerrada correctamente.");
    window.location.href = "login.html";
  });
}

// VALIDAR COMPRA
function validarSesionParaCompra() {
  const mensaje = document.getElementById("bloqueo-compra");
  auth.onAuthStateChanged(user => {
    if (!mensaje) return;
    if (user) {
      mensaje.innerHTML = `<p style="color: green; font-weight: bold;">Estás logeado como <strong>${user.email}</strong>. Puedes proceder con el pago.</p>`;
    } else {
      mensaje.innerHTML = `<p style="color: red; font-weight: bold;">Debes iniciar sesión para continuar.</p>`;
    }
  });
}

// INICIALIZACIÓN SEGÚN PÁGINA
if (window.location.pathname.includes("carrito.html")) {
  mostrarCarrito();
  validarSesionParaCompra();
}
if (window.location.pathname.includes("cuenta.html")) {
  mostrarUsuario();
  mostrarHistorial();
}
function mostrarCategoria(categoria) {
  const productosContainer = document.getElementById("productos");
  productosContainer.innerHTML = ""; // Limpia el contenido previo

  // Puedes reemplazar esta lista por una consulta a Firestore si quieres hacerlo dinámico
  const productosPorCategoria = {
    motores: [
      { nombre: "Filtro de Aceite", precio: 25990, imagen: "filtro_aceite.jpg" },
      { nombre: "Alternador", precio: 109990, imagen: "alternador.jpg" }
    ],
    frenos: [
      { nombre: "Pastillas de Freno", precio: 45500, imagen: "pastillas--frenos.jpg" },
      { nombre: "Discos de Freno", precio: 62000, imagen: "discos_frenos.jpg" }
    ],
    electricidad: [
      { nombre: "Batería Bosch", precio: 85990, imagen: "bateria.jpg" }
    ],
    accesorios: [
      { nombre: "Kit de Emergencia", precio: 12500, imagen: "kit-emergencia.jpg" },
      { nombre: "Cubreasiento", precio: 21990, imagen: "cubre-asiento.jpg" }
    ]
  };

  const productos = productosPorCategoria[categoria] || [];

  productos.forEach(p => {
    productosContainer.innerHTML += `
      <div class="producto">
        <img src="${p.imagen}" alt="${p.nombre}">
        <h3>${p.nombre}</h3>
        <p>$${p.precio.toLocaleString('es-CL')}</p>
        <button onclick="agregarAlCarrito('${p.nombre}', ${p.precio}, '${p.imagen}')">Agregar al carrito</button>
      </div>`;
  });
}

