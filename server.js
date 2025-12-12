const express = require('express');
const path = require('path');
const session = require('express-session');

const { sequelize, User, City, Hotel, Tour, Booking } = require('./models');

const app = express();
const PORT = 3000;

// ---------------------- HELPER FUNCTIONS ----------------------
// Функция для правильного склонения слова "результат"
function getTourWord(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return 'результат';
  } else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) {
    return 'результата';
  } else {
    return 'результатов';
  }
}

// ---------------------- MIDDLEWARE ----------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'SinkSpace',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Подгружаем пользователя (если авторизован)
app.use(async (req, res, next) => {
  if (req.session.userId) {
    req.user = await User.findByPk(req.session.userId);
  } else {
    req.user = null;
  }
  res.locals.user = req.user;
  next();
});

// ---------------------- ROUTES ----------------------

// Главная
app.get('/', async (req, res) => {
  const tours = await Tour.findAll({
    limit: 6,
    order: [['id', 'ASC']],
    include: [City, Hotel]
  });

  res.render('index', { tours });
});

// Каталог
app.get('/catalog', async (req, res) => {
  const tours = await Tour.findAll({ include: [City, Hotel] });
  res.render('catalog', { tours });
});

// Страница тура
app.get('/tour/:id', async (req, res) => {
  const tour = await Tour.findByPk(req.params.id, { include: [City, Hotel] });

  if (!tour) return res.status(404).render('404');

  res.render('tour', { tour });
});

// Профиль
app.get('/profile', async (req, res) => {
  if (!req.user) return res.redirect('/login');

  const tours = await Tour.findAll({
    limit: 10,
    include: [City, Hotel]
  });

  res.render('profile', {
    user: req.user,
    tours
  });
});

// Корзина
app.get('/cart', (req, res) => res.render('cart'));

// Подобрать тур (старая версия - можно удалить если не используется)
app.get('/take-tour', async (req, res) => {
  try {
    const cities = await City.findAll();
    const hotels = await Hotel.findAll();
    const tours = await Tour.findAll({ include: [City, Hotel] });

    res.render('take-tour', { 
      cities, 
      hotels, 
      tours,
      getTourWord 
    });
  } catch (err) {
    console.error('Ошибка загрузки страницы Подобрать тур:', err);
    res.status(500).render('error', {
      message: 'Не удалось загрузить страницу Подобрать тур',
      title: 'Ошибка'
    });
  }
});

// Поиск/подбор тура (GET запрос)
app.get('/search', async (req, res) => {
  try {
    const cities = await City.findAll();
    const hotels = await Hotel.findAll();
    const tours = await Tour.findAll({ include: [City, Hotel] });

    res.render('search', { 
      cities, 
      hotels, 
      tours,
      getTourWord // передаем функцию в шаблон
    });
  } catch (err) {
    console.error('Ошибка загрузки страницы Подбора тура:', err);
    res.status(500).render('error', {
      message: 'Не удалось загрузить страницу Подбора тура',
      title: 'Ошибка'
    });
  }
});

// Поиск/подбор тура (POST запрос - фильтрация)
app.post('/search', async (req, res) => {
  try {
    const { cityId, hotelId, minPrice, maxPrice, startDate, duration, meal, type, hotelType } = req.body;

    const where = {};

    if (cityId) where.CityId = cityId;
    if (hotelId) where.HotelId = hotelId;
    
    // Фильтр по цене
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }
    
    // Фильтр по дате начала (если нужно)
    if (startDate) {
      // Здесь можно добавить логику фильтрации по дате
      // зависит от структуры вашей модели Tour
    }
    
    // Фильтр по продолжительности
    if (duration) {
      where.duration = duration;
    }
    
    // Фильтр по типу питания
    if (meal) {
      where.mealType = meal;
    }
    
    // Фильтр по типу отдыха
    if (type) {
      where.tourType = type;
    }
    
    // Фильтр по типу отеля (нужно добавить поле hotelType в модель Tour)
    if (hotelType) {
      // where.hotelType = hotelType;
    }

    const tours = await Tour.findAll({
      where,
      include: [City, Hotel]
    });

    const cities = await City.findAll();
    const hotels = await Hotel.findAll();

    res.render('search', { 
      cities, 
      hotels, 
      tours,
      getTourWord // передаем функцию в шаблон
    });
  } catch (err) {
    console.error('Ошибка при поиске туров:', err);
    res.status(500).render('error', {
      message: 'Не удалось выполнить поиск туров',
      title: 'Ошибка поиска'
    });
  }
});

// ---------------------- AUTH ----------------------

// Login page
app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ where: { username, password } });

  if (!user) {
    return res.render('login', { error: 'Неверный логин/пароль' });
  }

  req.session.userId = user.id;
  res.redirect('/');
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Register page
app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  try {
    const newUser = await User.create({ username, password });
    req.session.userId = newUser.id;
    res.redirect('/');
  } catch (err) {
    res.render('register', { error: 'Ошибка регистрации' });
  }
});

// ---------------------- ADMIN FORMS ----------------------
app.get('/add-city', (req, res) => res.render('add-city'));
app.get('/add-client', (req, res) => res.render('add-client'));
app.get('/add-hotel', (req, res) => res.render('add-hotel'));
app.get('/add-tour', (req, res) => res.render('add-tour'));

app.get('/edit-tour/:id', async (req, res) => {
  const tour = await Tour.findByPk(req.params.id);
  if (!tour) return res.status(404).render('404');
  res.render('edit-tour', { tour });
});

// ---------------------- 404 ----------------------
app.use((req, res) => res.status(404).render('404'));

// ---------------------- DB INIT ----------------------
(async () => {
  try {
    await sequelize.sync({ force: true });

    const [moscow, paris] = await City.bulkCreate([
      { name: 'Москва', country: 'Россия' },
      { name: 'Париж', country: 'Франция' }
    ], { returning: true });

    const [hotelMoscow, hotelParis] = await Hotel.bulkCreate([
      { name: 'Отель Москва', stars: 5, address: 'ул. Тверская, 1' },
      { name: 'Отель Париж', stars: 4, address: 'ул. Елисейские поля, 10' }
    ], { returning: true });

    await User.bulkCreate([
      { username: 'admin', password: 'adminpass', role: 'admin' },
      { username: 'client', password: 'clientpass', role: 'client' }
    ]);

    await Tour.bulkCreate([
      { name: 'Экскурсия по Москве', description: 'Обзорная экскурсия', price: 15000, duration: 3, CityId: moscow.id, HotelId: hotelMoscow.id },
      { name: 'Романтический Париж', description: 'Тур для влюблённых', price: 45000, duration: 7, CityId: paris.id, HotelId: hotelParis.id }
    ]);

    app.listen(PORT, () =>
      console.log(`Server running at http://localhost:${PORT}`)
    );

  } catch (err) {
    console.error(err);
  }
})();