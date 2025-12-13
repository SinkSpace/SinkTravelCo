module.exports = (sequelize, DataTypes) => {
  return sequelize.define('City', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    country: { type: DataTypes.STRING, allowNull: false }
  });
};