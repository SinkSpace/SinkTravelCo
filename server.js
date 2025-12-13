import express from 'express';
import path from 'path';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import multer from 'multer';

import {
  sequelize,
  User,
  City,
  Hotel,
  Tour,
  SiteContent
} from './models/index.js';

// Настройка multer
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

const app = express();
const PORT = 3000;

/* =======================
   НАСТРОЙКИ
======================= */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: 'SinkSpace',
    resave: false,
    saveUninitialized: false
  })
);

/* =======================
   ПОЛЬЗОВАТЕЛЬ ИЗ СЕССИИ
======================= */
app.use(async (req, res, next) => {
  if (req.session.userId) {
    req.user = await User.findByPk(req.session.userId);
  } else {
    req.user = null;
  }
  res.locals.user = req.user;
  next();
});

/* =======================
   ПУБЛИЧНЫЕ СТРАНИЦЫ
======================= */
app.get('/', async (req, res) => {
  const tours = await Tour.findAll({
    limit: 6,
    include: [City, Hotel]
  });

  const content = await SiteContent.findByPk(1);
  res.render('index', { tours, content });
});

app.get('/catalog', async (req, res) => {
  const tours = await Tour.findAll({ include: [City, Hotel] });
  res.render('catalog', { tours });
});

app.get('/tour/:id', async (req, res) => {
  const tour = await Tour.findByPk(req.params.id, {
    include: [City, Hotel]
  });

  if (!tour) return res.status(404).render('404');
  res.render('tour', { tour });
});

/* =======================
   АВТОРИЗАЦИЯ
======================= */
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ where: { username } });
  if (!user) return res.render('login', { error: 'Неверный логин или пароль' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.render('login', { error: 'Неверный логин или пароль' });

  req.session.userId = user.id;

  if (user.role === 'admin') return res.redirect('/admin-panel');
  if (user.role === 'moder') return res.redirect('/moder-panel');
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* =======================
   АДМИН-ПАНЕЛЬ
======================= */
app.get('/admin-panel', async (req, res) => {
  if (!req.user || req.user.role !== 'admin') return res.redirect('/login');

  const tours = await Tour.findAll({ include: [City, Hotel] });
  const cities = await City.findAll({ order: [['name', 'ASC']] });
  const hotels = await Hotel.findAll({ order: [['name', 'ASC']] });
  const content = await SiteContent.findByPk(1);

  res.render('admin-panel', { user: req.user, tours, cities, hotels, content });
});

/* =======================
   ДОБАВЛЕНИЕ ГОРОДА
======================= */
app.get('/admin/add-city', (req, res) => res.render('add-city'));

app.post('/admin/add-city', async (req, res) => {
  const { name, country } = req.body;
  await City.create({ name, country });
  res.redirect('/admin-panel');
});

app.post('/admin/delete-city/:id', async (req, res) => {
  await City.destroy({ where: { id: req.params.id } });
  res.redirect('/admin-panel');
});

app.post('/admin/delete-hotel/:id', async (req, res) => {
  await Hotel.destroy({ where: { id: req.params.id } });
  res.redirect('/admin-panel');
});

/* =======================
   ДОБАВЛЕНИЕ ТУРА
======================= */
app.get('/admin/add-tour', async (req, res) => {
  const cities = await City.findAll();
  const hotels = await Hotel.findAll();
  res.render('add-tour', { cities, hotels, clients: [] });
});

app.post('/admin/add-tour', async (req, res) => {
  const { name, description, price, duration, cityId, hotelId } = req.body;
  await Tour.create({ name, description, price, duration, CityId: cityId, HotelId: hotelId });
  res.redirect('/admin-panel');
});

/* =======================
   РЕДАКТИРОВАНИЕ ТУРА
======================= */
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

/* =======================
   МОДЕРАТОР
======================= */
app.get('/moder-panel', (req, res) => {
  if (!req.user || req.user.role !== 'moder') return res.redirect('/login');
  res.send('<h1>Модер-панель</h1><a href="/logout">Выйти</a>');
});

/* =======================
   404
======================= */
app.use((req, res) => res.status(404).render('404'));

/* =======================
   ЗАПУСК
======================= */
(async () => {
  try {
    await sequelize.sync();

    // создаём контент, если нет
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

    // создаём туры, если их нет
    const tourCount = await Tour.count();
    if (tourCount === 0) {
      const tourData = [
        {
          city: { name: 'Париж', country: 'Франция' },
          hotel: { name: 'Hotel Lumière', stars: 5, address: 'Rue de Rivoli, 1' },
          name: 'Романтический Париж',
          description: 'Прогулки по набережной Сены, Эйфелева башня и уютные кафе.',
          price: 2500,
          duration: 5
        },
        {
          city: { name: 'Рим', country: 'Италия' },
          hotel: { name: 'Roma Bella', stars: 4, address: 'Via Veneto, 12' },
          name: 'Исторический Рим',
          description: 'Колизей, Ватикан и вкуснейшая итальянская кухня.',
          price: 2200,
          duration: 4
        },
        {
          city: { name: 'Барселона', country: 'Испания' },
          hotel: { name: 'Casa Barcelona', stars: 4, address: 'Passeig de Gràcia, 5' },
          name: 'Солнечная Барселона',
          description: 'Гауди, пляжи и тапас-вечеринки под звёздами.',
          price: 2100,
          duration: 5
        },
        {
          city: { name: 'Лондон', country: 'Великобритания' },
          hotel: { name: 'The Crown', stars: 5, address: 'Baker Street, 221B' },
          name: 'Лондонская классика',
          description: 'Биг-Бен, Букингемский дворец и экскурсии по Темзе.',
          price: 2700,
          duration: 6
        },
        {
          city: { name: 'Прага', country: 'Чехия' },
          hotel: { name: 'Prague Palace', stars: 4, address: 'Karlova, 3' },
          name: 'Очарование Праги',
          description: 'Старинные мосты, уютные улочки и местное пиво.',
          price: 1800,
          duration: 4
        },
        {
          city: { name: 'Берлин', country: 'Германия' },
          hotel: { name: 'Berlin Art', stars: 4, address: 'Unter den Linden, 7' },
          name: 'Современный Берлин',
          description: 'История и арт-сцена, экскурсии и клубы.',
          price: 2000,
          duration: 4
        },
        {
          city: { name: 'Амстердам', country: 'Нидерланды' },
          hotel: { name: 'Tulip Inn', stars: 3, address: 'Prinsengracht, 50' },
          name: 'Амстердам на велосипедах',
          description: 'Каналы, музеи и голландские сыры.',
          price: 1900,
          duration: 3
        },
        {
          city: { name: 'Вена', country: 'Австрия' },
          hotel: { name: 'Vienna Royal', stars: 5, address: 'Ringstraße, 10' },
          name: 'Классическая Вена',
          description: 'Оперные вечера, дворцы и кофе по-венски.',
          price: 2300,
          duration: 4
        },
        {
          city: { name: 'Стамбул', country: 'Турция' },
          hotel: { name: 'Istanbul View', stars: 4, address: 'Sultanahmet, 15' },
          name: 'Стамбулская сказка',
          description: 'Голубая мечеть, базары и турецкий чай.',
          price: 1700,
          duration: 4
        },
        {
          city: { name: 'Киото', country: 'Япония' },
          hotel: { name: 'Kyoto Garden', stars: 5, address: 'Gion, 2' },
          name: 'Японская гармония',
          description: 'Храмы, сакура и чайные церемонии.',
          price: 3000,
          duration: 6
        },
        {
          city: { name: 'Нью-Йорк', country: 'США' },
          hotel: { name: 'Central Park Inn', stars: 5, address: '5th Avenue, 101' },
          name: 'Большое яблоко',
          description: 'Статуя Свободы, Таймс-сквер и Broadway-шоу.',
          price: 2800,
          duration: 5
        },
        {
          city: { name: 'Сидней', country: 'Австралия' },
          hotel: { name: 'Harbour View', stars: 4, address: 'Sydney Harbour, 10' },
          name: 'Сиднейские приключения',
          description: 'Опера, пляжи и серфинг.',
          price: 3200,
          duration: 7
        },
        {
          city: { name: 'Рейкьявик', country: 'Исландия' },
          hotel: { name: 'Northern Lights', stars: 3, address: 'Laugavegur, 12' },
          name: 'Ледяная Исландия',
          description: 'Гейзеры, водопады и северное сияние.',
          price: 3500,
          duration: 5
        },
        {
          city: { name: 'Каир', country: 'Египет' },
          hotel: { name: 'Pyramid View', stars: 4, address: 'Al Haram, 1' },
          name: 'Древний Каир',
          description: 'Пирамиды, Нил и базары.',
          price: 1800,
          duration: 4
        },
        {
          city: { name: 'Рио-де-Жанейро', country: 'Бразилия' },
          hotel: { name: 'Copacabana Inn', stars: 4, address: 'Copacabana, 5' },
          name: 'Карнавал Рио',
          description: 'Пляжи, статуя Христа и самба.',
          price: 2400,
          duration: 5
        },
        {
          city: { name: 'Бангкок', country: 'Таиланд' },
          hotel: { name: 'Bangkok Palace', stars: 4, address: 'Sukhumvit, 22' },
          name: 'Бангкокский вихрь',
          description: 'Храмы, рынки и тайская еда.',
          price: 1900,
          duration: 4
        },
        {
          city: { name: 'Дубай', country: 'ОАЭ' },
          hotel: { name: 'Burj View', stars: 5, address: 'Downtown, 1' },
          name: 'Роскошь Дубая',
          description: 'Бурдж-Халифа, шоппинг и пустынные сафари.',
          price: 3300,
          duration: 5
        },
        {
          city: { name: 'Сан-Франциско', country: 'США' },
          hotel: { name: 'Golden Gate Hotel', stars: 4, address: 'Lombard St, 10' },
          name: 'Сан-Франциско',
          description: 'Золотые ворота, Алькатрас и трамваи.',
          price: 2600,
          duration: 4
        },
        {
          city: { name: 'Лиссабон', country: 'Португалия' },
          hotel: { name: 'Lisboa Bella', stars: 4, address: 'Rua Augusta, 15' },
          name: 'Лиссабонские улочки',
          description: 'Трамваи, пастéis de nata и уютные площади.',
          price: 2100,
          duration: 4
        },
        {
          city: { name: 'Будапешт', country: 'Венгрия' },
          hotel: { name: 'Danube View', stars: 4, address: 'Szechenyi, 3' },
          name: 'Будапештская сказка',
          description: 'Термальные купальни, Дунай и ночные прогулки.',
          price: 2000,
          duration: 3
        }
      ];

      for (const t of tourData) {
        // создаём город, если не существует
        let city = await City.findOne({ where: { name: t.city.name } });
        if (!city) city = await City.create(t.city);

        // создаём отель
        let hotel = await Hotel.findOne({ where: { name: t.hotel.name } });
        if (!hotel) hotel = await Hotel.create({ ...t.hotel, CityId: city.id });

        await Tour.create({
          name: t.name,
          description: t.description,
          price: t.price,
          duration: t.duration,
          CityId: city.id,
          HotelId: hotel.id
        });
      }

      console.log('✅ Создано 20 туров с примерами');
    }

    app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
  } catch (err) {
    console.error(err);
  }
})();


