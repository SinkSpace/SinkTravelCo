import express from 'express';
import path from 'path';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { Sequelize, Op } from 'sequelize';

import {
  sequelize,
  User,
  City,
  Hotel,
  Tour,
  SiteContent
} from './models/index.js';

// =======================
// Настройка multer
// =======================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public/uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ storage });

// =======================
// Инициализация сервера
// =======================
const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: 'SinkSpace',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 день
  })
);

// =======================
// Пользователь из сессии
// =======================
app.use(async (req, res, next) => {
  if (req.session.userId) {
    req.user = await User.findByPk(req.session.userId);
  } else {
    req.user = null;
  }
  res.locals.user = req.user;
  next();
});

// =======================
// Публичные страницы
// =======================
app.get('/', async (req, res) => {
  const tours = await Tour.findAll({ limit: 6, include: [City, Hotel] });
  const content = await SiteContent.findByPk(1);
  res.render('index', { tours, content });
});

app.get('/catalog', async (req, res) => {
  const tours = await Tour.findAll({ include: [City, Hotel] });
  res.render('catalog', { tours });
});

app.get('/tour/:id', async (req, res) => {
  const tour = await Tour.findByPk(req.params.id, { include: [City, Hotel] });
  if (!tour) return res.status(404).render('404');

  const similarTours = await Tour.findAll({
    where: { id: { [Op.ne]: tour.id } }, // исключаем текущий тур
    include: [City, Hotel],
    order: sequelize.random(),
    limit: 2
  });

  res.render('tour', { tour, similarTours });
});

app.get('/search', async (req, res) => {
  try {
    const cities = await City.findAll();
    const hotels = await Hotel.findAll();
    // По умолчанию показываем все туры
    const tours = await Tour.findAll({ include: [City, Hotel] });
    
    res.render('search', { user: req.user, cities, hotels, tours });
  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера');
  }
});

app.get('/take-tour', async (req, res) => {
  const cities = await City.findAll();
  const hotels = await Hotel.findAll();
  const tours = await Tour.findAll({ include: [City, Hotel] });

  res.render('take-tour', { user: req.user, cities, hotels, tours });
});

// POST: фильтрация туров
app.post('/take-tour', async (req, res) => {
  const { cityId, duration, hotelId, hotelStars, minPrice, maxPrice } = req.body;

  const filter = {};

  if (cityId) filter.cityId = cityId;
  if (duration) filter.duration = duration;
  if (hotelId) filter.hotelId = hotelId;
  if (minPrice) filter.price = { ...(filter.price || {}), [Op.gte]: Number(minPrice) };
  if (maxPrice) filter.price = { ...(filter.price || {}), [Op.lte]: Number(maxPrice) };
  if (hotelStars) filter['$Hotel.stars$'] = hotelStars; // через include

  const cities = await City.findAll();
  const hotels = await Hotel.findAll();

  const tours = await Tour.findAll({
    where: filter,
    include: [Hotel, City]
  });

  res.render('take-tour', { user: req.user, cities, hotels, tours });
});

// =======================
// Страница регистрации
// =======================
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Проверка существующего пользователя
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.render('register', { error: 'Пользователь с таким логином уже существует' });
    }

    // Создание нового пользователя
    const newUser = await User.create({ username, password, role: 'client' });

    // Логиним сразу
    req.session.userId = newUser.id;
    res.redirect('/catalog');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Ошибка при регистрации' });
  }
});

// =======================
// Профиль пользователя
// =======================
app.get('/profile', async (req, res) => {
  if (!req.user) return res.redirect('/login'); // если не авторизован, кидаем на логин

  // Если нужно, можно получить дополнительные данные, например туры пользователя
  // const userTours = await Tour.findAll({ where: { UserId: req.user.id } });

  res.render('profile', { user: req.user /*, tours: userTours */ });
});

// =======================
// Авторизация
// =======================
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username, password);

  const user = await User.findOne({ where: { username } });
  console.log('Found user:', user);

  if (!user) return res.render('login', { error: 'Неверный логин или пароль' });

  const ok = await bcrypt.compare(password, user.password);
  console.log('Password match:', ok);

  if (!ok) return res.render('login', { error: 'Неверный логин или пароль' });

  req.session.userId = user.id;
  res.redirect('/catalog');
});


app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// =======================
// Админ-панель
// =======================
app.get('/admin-panel', async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/login');

  const tours = await Tour.findAll({ include: [City, Hotel] });
  const cities = await City.findAll({ order: [['name', 'ASC']] });
  const hotels = await Hotel.findAll({ order: [['name', 'ASC']] });
  const content = await SiteContent.findByPk(1);

  res.render('admin-panel', { user: req.user, tours, cities, hotels, content });
});

// =======================
// Добавление города
// =======================
// GET форма добавления города
app.get('/admin/add-city', (req, res) => {
  res.render('add-city', { error: null });
});

// POST обработка добавления города
app.post('/admin/add-city', async (req, res) => {
  try {
    const { name, country } = req.body;

    if (!name || !country) {
      return res.render('add-city', { error: 'Заполните все обязательные поля' });
    }

    await City.create({ name, country });

    res.redirect('/admin-panel');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при добавлении города');
  }
});

// GET форма добавления отеля
app.get('/admin/add-hotel', async (req, res) => {
  const cities = await City.findAll();
  res.render('add-hotel', { cities, error: null });
});

// POST обработка
app.post('/admin/add-hotel', async (req, res) => {
  try {
    const { name, stars, address, cityId } = req.body;

    if (!name || !stars || !cityId) {
      const cities = await City.findAll();
      return res.render('add-hotel', { cities, error: 'Заполните все обязательные поля' });
    }

    await Hotel.create({
      name,
      stars: parseInt(stars),
      address: address || '',
      CityId: parseInt(cityId)
    });

    res.redirect('/admin-panel');
  } catch (err) {
    console.error(err);
    res.send('Ошибка при добавлении отеля');
  }
});

app.post('/admin/delete-hotel/:id', async (req, res) => {
  await Hotel.destroy({ where: { id: req.params.id } });
  res.redirect('/admin-panel');
});

app.post('/admin/delete-city/:id', async (req, res) => {
  await City.destroy({ where: { id: req.params.id } });
  res.redirect('/admin-panel');
});


// =======================
// Добавление тура
// =======================
app.get('/admin/add-tour', async (req, res) => {
  const cities = await City.findAll();
  const hotels = await Hotel.findAll();
  res.render('add-tour', { cities, hotels });
});

// POST для добавления тура с файлом
app.post('/admin/add-tour', upload.single('image'), async (req, res) => {
  try {
    // req.body теперь доступен, multer распарсил форму
    const { name, description, price, duration, cityId, hotelId, clientId } = req.body;

    const newTour = await Tour.create({
      name,
      description,
      price,
      duration,
      CityId: cityId,
      HotelId: hotelId,
      ClientId: clientId || null, // если клиента не выбрали
      image: req.file ? '/uploads/' + req.file.filename : null
    });

    res.redirect('/admin-panel');
  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка при добавлении тура');
  }
});




// =======================
// Редактирование тура
// =======================
app.get('/admin/edit-tour/:id', async (req, res) => {
  const tour = await Tour.findByPk(req.params.id);
  const cities = await City.findAll();
  const hotels = await Hotel.findAll();
  res.render('edit-tour', { tour, cities, hotels, clients: [] });
});

app.post('/admin/update-tour/:id', upload.single('image'), async (req, res) => {
  const tour = await Tour.findByPk(req.params.id);
  if (!tour) return res.redirect('/admin-panel');

  const { name, description, price, duration, cityId, hotelId } = req.body;
  if (req.file) tour.image = '/uploads/' + req.file.filename;

  tour.name = name;
  tour.description = description;
  tour.price = price;
  tour.duration = duration;
  tour.CityId = cityId;
  tour.HotelId = hotelId;

  await tour.save();
  res.redirect('/admin-panel');
});

// =======================
// Модер-панель
// =======================
app.get('/moder-panel', (req, res) => {
  if (!req.user || req.user.role !== 'moder') return res.redirect('/login');
  res.send('<h1>Модер-панель</h1><a href="/logout">Выйти</a>');
});

// =======================
// 404
// =======================
app.use((req, res) => res.status(404).render('404'));

// =======================
// Создание начальных пользователей (с исправлением хэша)
// =======================
async function createDefaultUsers() {
  const usersData = [
    { username: 'admin', password: 'adminpass', role: 'admin' },
    { username: 'moder', password: 'moderpass', role: 'moder' },
    { username: 'user', password: 'userpass', role: 'client' }
  ];

  for (const u of usersData) {
    const existing = await User.findOne({ where: { username: u.username } });
    if (!existing) {
      await User.create(u);
      console.log(`Создан пользователь ${u.username}`);
    } else {
      // Обновляем пароль, чтобы сработал beforeUpdate и был корректный хэш
      existing.password = u.password;
      await existing.save();
      console.log(`Обновлён пароль пользователя ${u.username}`);
    }
  }
}



// =======================
// Запуск сервера
// =======================
(async () => {
  try {
    await sequelize.sync();

    // Контент сайта
    await SiteContent.findOrCreate({
      where: { id: 1 },
      defaults: {
        slogan: 'Воспоминания, которые останутся навсегда.',
        description: 'А мы поможем их получить',
        advantage1_title: 'Индивидуальный подбор',
        advantage1_text: 'Подберём отдых под ваши желания',
        advantage2_title: 'Проверенные операторы',
        advantage2_text: 'Работаем с надёжными партнёрами',
        advantage3_title: 'Поддержка 24/7',
        advantage3_text: 'Мы на связи в любой точке мира',
        advantage4_title: 'Честные цены',
        advantage4_text: 'Без скрытых платежей и доплат'
      }
    });

    // Создание пользователей
    await createDefaultUsers();

    app.listen(PORT, () => console.log(`🚀 Сервер запущен: http://localhost:${PORT}`));
  } catch (err) {
    console.error(err);
  }
})();
