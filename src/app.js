require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');

const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');
const { getMarca } = require('./services/marca');
const { agendarBackups } = require('./services/backup');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'troque-este-segredo-em-producao',
    resave: false,
    saveUninitialized: false,
    rolling: true, // renova as 8h a cada uso: o painel do bar não desloga no meio do expediente
    cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 horas
  })
);

// Nome, logo e cores do restaurante disponíveis em todas as páginas
app.use((req, res, next) => {
  res.locals.marca = getMarca();
  res.locals.caminhoAtual = req.path; // pra destacar a página atual no menu do admin
  next();
});

app.get('/', (req, res) => res.redirect('/admin'));

app.use('/', customerRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => res.status(404).send('Página não encontrada.'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  console.log('Acesse o painel admin em /admin (login: admin)');
  agendarBackups();
});
