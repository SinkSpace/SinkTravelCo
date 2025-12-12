const express = require('express');
const path = require('path');
const session = require('express-session');
const { Sequelize, DataTypes } = require('sequelize');
const { sequelize, User, City, Hotel, Client, Tour } = require('./models');

const app = express();
const PORT = 3000;

// ---------------------- БД ----------------------
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './db.sqlite'
});

// ---------------------- МОДЕЛИ ----------------------
const User = sequelize.define('User', {
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin','client'), defaultValue: 'client' },
  firstName: DataTypes.STRING,
  lastName: DataTypes.STRING,
  middleName: DataTypes.STRING,
  email: { type: DataTypes.STRING, unique: true },
  phone: DataTypes.STRING,
  birthDate: DataTypes.DATEONLY,
  gender: DataTypes.ENUM('male','female','other')
});

const City = sequelize.define('City', {
  name: { type: DataTypes.STRING, allowNull: false },
  country: { type: DataTypes.STRING, allowNull: false }
});

const Hotel = sequelize.define('Hotel', {
  name: { type: DataTypes.STRING, allowNull: false },
  stars: DataTypes.INTEGER,
  address: DataTypes.STRING
});

const Tour = sequelize.define('Tour', {
  name: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  price: { type: DataTypes.FLOAT, allowNull: false },
  duration: DataTypes.INTEGER,
  type: DataTypes.ENUM('экскурсия','пляж','горнолыжный','круиз','комбинированный'),
  visaRequired: { type: DataTypes.BOOLEAN, defaultValue: false },
  flightType: DataTypes.ENUM('самолет','поезд','автобус','комбинированный'),
  onSpotPriceType: DataTypes.ENUM('наличные','карта','любой'),
  tripTime: DataTypes.STRING,
  features: DataTypes.TEXT,
  foodType: DataTypes.ENUM('без питания','завтрак','полупансион','полный пансион','всё включено'),
  rating: { type: DataTypes.FLOAT, defaultValue: 0 }
});

const Booking = sequelize.define('Booking', {
  status: { type: DataTypes.ENUM('ожидает','подтверждено','отменено'), defaultValue: 'ожидает' },
  totalPrice: DataTypes.FLOAT,
  paid: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// ---------------------- СВЯЗИ ----------------------
Tour.belongsTo(City);
Tour.belongsTo(Hotel);
Booking.belongsTo(User);
Booking.belongsTo(Tour);
User.hasMany(Booking);
Tour.hasMany(Booking);

// ---------------------- MIDDLEWARE ----------------------
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'SinkSpace',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Простая авторизация (для теста)
app.use(async (req,res,next)=>{
  if(req.session.userId){
    req.user = await User.findByPk(req.session.userId);
  }
  res.locals.user = req.user;
  next();
});

// ---------------------- ROUTES ----------------------
app.get('/', async (req,res)=>{
  const tours = await Tour.findAll({ limit: 10, order: [['id','ASC']] });
  res.render('index',{ tours });
});

app.get('/login',(req,res)=>res.render('login'));
app.post('/login', async (req,res)=>{
  const { username, password } = req.body;
  const user = await User.findOne({ where: { username, password }});
  if(user){
    req.session.userId = user.id;
    return res.redirect('/');
  }
  res.send('Неверный логин/пароль');
});

app.get('/logout',(req,res)=>{
  req.session.destroy(()=>res.redirect('/'));
});

app.get('/catalog', async (req,res) => {
  const tours = await Tour.findAll({ limit: 20, order: [['id','ASC']] });
  res.render('catalog', { tours, user: req.user });
});

app.get('/profile', async (req,res)=>{
  if(!req.user) return res.redirect('/login');
  const tours = await Tour.findAll({ limit: 10 });
  res.render('profile',{ tours });
});

app.get('/tour/:id', async (req, res) => {
  const tour = await Tour.findByPk(req.params.id, {
    include: [City, Hotel, Client] // если нужно выводить связанные данные
  });
  if (!tour) return res.status(404).send('Тур не найден');
  res.render('tour', { tour, user: req.user });
});

// ---------------------- SYNC & ТЕСТОВЫЕ ДАННЫЕ ----------------------
(async ()=>{
  try{
    await sequelize.sync({ force: true });

    // Города
    const [moscow, paris] = await City.bulkCreate([
      { name:'Москва', country:'Россия' },
      { name:'Париж', country:'Франция' }
    ], { returning:true });

    // Отели
    const [hotelMoscow, hotelParis] = await Hotel.bulkCreate([
      { name:'Отель Москва', stars:5, address:'ул. Тверская,1' },
      { name:'Отель Париж', stars:4, address:'ул. Елисейские поля,10' }
    ], { returning:true });

    // Пользователи
    const [admin, client] = await User.bulkCreate([
      { username:'admin', password:'adminpass', role:'admin', firstName:'Админ', lastName:'Админов', email:'admin@example.com' },
      { username:'client', password:'clientpass', role:'client', firstName:'Иван', lastName:'Иванов', email:'ivan@example.com' }
    ], { individualHooks:true, returning:true });

    // Туры
    await Tour.bulkCreate([
      {
        name:'Экскурсия по Москве',
        description:'Обзорная экскурсия по главным достопримечательностям Москвы.',
        price:15000.0, duration:3, type:'экскурсия', visaRequired:false,
        flightType:'автобус', onSpotPriceType:'наличные', tripTime:'лето',
        features:'гид, трансфер', foodType:'завтрак', rating:4.7,
        CityId: moscow.id, HotelId: hotelMoscow.id
      },
      {
        name:'Романтический Париж',
        description:'Тур для влюблённых по самому романтичному городу мира.',
        price:45000.0, duration:7, type:'комбинированный', visaRequired:true,
        flightType:'самолет', onSpotPriceType:'карта', tripTime:'весна',
        features:'гид, ужин при свечах', foodType:'полный пансион', rating:4.9,
        CityId: paris.id, HotelId: hotelParis.id
      }
    ]);

    app.listen(PORT,()=>console.log(`Server running at http://localhost:${PORT}`));
  }catch(e){
    console.error(e);
  }
})();
