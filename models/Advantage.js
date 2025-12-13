module.exports = (sequelize, DataTypes) => {
  const Advantage = sequelize.define('Advantage', {
    title: { type: DataTypes.STRING, allowNull: false },
    text: { type: DataTypes.TEXT, allowNull: false },
    icon: { type: DataTypes.STRING, allowNull: false, defaultValue: '/images/default.svg' },
    order: { type: DataTypes.INTEGER, defaultValue: 0 }
  });
  return Advantage;
};