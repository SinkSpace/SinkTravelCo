module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Hotel', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    stars: { type: DataTypes.INTEGER, allowNull: false },
    address: { type: DataTypes.STRING }
  });
};