require("dotenv").config();
const express = require("express");
const sequelize = require("./config/database");
const apiRoutes = require("./routes/api");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

// Import models to register associations before sync
require("./models");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Crypto C2C Exchange API",
      version: "1.0.0",
      description:
        "REST API for a peer-to-peer cryptocurrency exchange platform",
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api", apiRoutes);

// Swagger UI served at root path
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

sequelize
  .sync()
  .then(() => console.log("Database synced successfully."))
  .catch((err) => console.error("Unable to connect to the database:", err));

app.listen(port, () =>
  console.log(`Server is running on http://localhost:${port}`)
);
