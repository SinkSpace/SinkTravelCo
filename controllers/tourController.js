const { Tour, City, Hotel, Client } = require('../models');

const tourController = {
  showHome: async (req, res) => {
    try {
      const tours = await Tour.findAll({
        include: [City, Hotel, Client],
        limit: 6
      });
      res.render('index', { 
        tours, 
        user: req.session.user,
        title: 'Главная - Туристическое агентство'
      });
    } catch (error) {
      console.error('Error fetching tours:', error);
      res.status(500).render('error', { 
        message: 'Ошибка загрузки туров',
        title: 'Ошибка'
      });
    }
  },

  showCatalog: async (req, res) => {
    try {
      const tours = await Tour.findAll({
        include: [City, Hotel, Client],
      });
      res.render('catalog', { 
        tours, 
        user: req.session.user,
        title: 'Каталог туров'
      });
    } catch (error) {
      console.error('Error fetching tours for catalog:', error);
      res.status(500).render('error', { 
        message: 'Ошибка загрузки каталога',
        title: 'Ошибка'
      });
    }
  },

  showDatabase: async (req, res) => {
    try {
      const tours = await Tour.findAll({
        include: [City, Hotel, Client],
      });
      res.render('database', { 
        tours, 
        user: req.session.user,
        title: 'База данных туров'
      });
    } catch (error) {
      console.error('Error fetching tours for database view:', error);
      res.status(500).render('error', { 
        message: 'Ошибка загрузки базы данных',
        title: 'Ошибка'
      });
    }
  },

  searchTours: async (req, res) => {
  try {
    const { cityId, hotelId, minPrice, maxPrice } = req.body;

    const where = {};
    if (cityId) where.cityId = cityId;
    if (hotelId) where.hotelId = hotelId;
    if (minPrice) where.price = { ...where.price, $gte: parseFloat(minPrice) };
    if (maxPrice) where.price = { ...where.price, $lte: parseFloat(maxPrice) };

    const tours = await Tour.findAll({
      where,
      include: [City, Hotel, Client],
    });

    res.render('search', { tours, user: req.session.user, cities: await City.findAll(), hotels: await Hotel.findAll(), title: 'Поиск туров' });
  } catch (error) {
    console.error('Error searching tours:', error);
    res.status(500).render('error', { message: 'Ошибка поиска туров', title: 'Ошибка' });
  }
}

};

module.exports = tourController;