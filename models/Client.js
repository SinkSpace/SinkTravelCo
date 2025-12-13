module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Client', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
    phone: { type: DataTypes.STRING }
  });
};