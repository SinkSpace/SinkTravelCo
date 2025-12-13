import { Sequelize } from 'sequelize';
import UserModel from './User.js';
import CityModel from './City.js';
import HotelModel from './Hotel.js';
import TourModel from './Tour.js';
import SiteContentModel from './SiteContent.js';

// Подключение к БД
export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database.sqlite'
});

// Модели
export const User = UserModel(sequelize, Sequelize.DataTypes);
export const City = CityModel(sequelize, Sequelize.DataTypes);
export const Hotel = HotelModel(sequelize, Sequelize.DataTypes);
export const Tour = TourModel(sequelize, Sequelize.DataTypes);
export const SiteContent = SiteContentModel(sequelize, Sequelize.DataTypes);

// Связи
City.hasMany(Hotel, { onDelete: 'CASCADE' });
Hotel.belongsTo(City);

City.hasMany(Tour);
Tour.belongsTo(City);

Hotel.hasMany(Tour);
Tour.belongsTo(Hotel);