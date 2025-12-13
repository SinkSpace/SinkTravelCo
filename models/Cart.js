module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Cart', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }
  });
};
