module.exports = (sequelize, DataTypes) => {
  return sequelize.define('SiteContent', {
    slogan: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
    advantage1_title: { type: DataTypes.STRING, allowNull: false },
    advantage1_text: { type: DataTypes.STRING, allowNull: false },
    advantage2_title: { type: DataTypes.STRING, allowNull: false },
    advantage2_text: { type: DataTypes.STRING, allowNull: false },
    advantage3_title: { type: DataTypes.STRING, allowNull: false },
    advantage3_text: { type: DataTypes.STRING, allowNull: false },
    advantage4_title: { type: DataTypes.STRING, allowNull: false },
    advantage4_text: { type: DataTypes.STRING, allowNull: false }
  });
};
