module.exports = (sequelize, DataTypes) => {
  return sequelize.define('CartItem', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 }
  });
};
