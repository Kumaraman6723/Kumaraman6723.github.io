const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const axios = require("axios");
const request = require("request");
const app = express();
const port = 3001;
const webhookUrl = "http://localhost:3002/webhook"; // Change to your webhook URL

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

const db = mysql.createConnection({
  host: "auth-db.c5ywgoci6p3e.us-east-1.rds.amazonaws.com",
  user: "admin",
  password: "CsSUH3IJwNkF7QAj86HQ",
  database: "auth-db",
  port: "3306",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the database.");
});

const createUsersTableQuery = `
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255),
    name VARCHAR(255),
    gender VARCHAR(50),
    birthday DATE,
    password VARCHAR(255),
    token VARCHAR(255),
    orgName VARCHAR(255),
    position VARCHAR(255),
    countryCode VARCHAR(10),
    contact VARCHAR(20),
    profilepicture TEXT
);
`;

const createLogsTableQuery = `
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    eventType VARCHAR(100),
    eventDescription TEXT,
    ip VARCHAR(45)
);
`;

const createDevicesTableQuery = `
CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255),
  entityName VARCHAR(255),
  deviceIMEI VARCHAR(255),
  simICCId VARCHAR(255),
  batterySLNo VARCHAR(255),
  panelSLNo VARCHAR(255),
  luminarySLNo VARCHAR(255),
  mobileNo VARCHAR(20),
  district VARCHAR(255),
  panchayat VARCHAR(255),
  block VARCHAR(255),
  wardNo VARCHAR(50),
  poleNo VARCHAR(50),
  active BOOLEAN,
  installationDate DATE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded
    ? forwarded.split(/, /)[0]
    : req.connection.remoteAddress;
  return ip;
}

// Execute create table queries
db.query(createDevicesTableQuery, (err, result) => {
  if (err) {
    console.error("Error creating devices table:", err);
    return;
  }
  console.log("Devices table created or already exists.");
});

db.query(createUsersTableQuery, (err, result) => {
  if (err) {
    console.error("Error creating users table:", err);
    return;
  }
  console.log("Users table created or already exists.");
});

db.query(createLogsTableQuery, (err, result) => {
  if (err) {
    console.error("Error creating logs table:", err);
    return;
  }
  console.log("Logs table created or already exists.");
});

function logEvent(eventType, eventDescription, ip) {
  const insertLogQuery = `
    INSERT INTO logs (eventType, eventDescription, ip)
    VALUES (?, ?, ?)
  `;
  db.query(insertLogQuery, [eventType, eventDescription, ip], (err, result) => {
    if (err) {
      console.error("Error inserting log:", err);
    }
  });
}

function sendToWebhook(data) {
  axios.post(webhookUrl, data).catch((err) => {
    console.error("Error sending to webhook:", err);
  });
}

app.post("/checkUser", (req, res) => {
  const { email } = req.body;
  const ip = getClientIp(req); // Get the IP address of the client
  const checkQuery = "SELECT * FROM users WHERE email = ?";
  db.query(checkQuery, [email], (err, results) => {
    if (err) {
      console.error("Error checking user:", err);
      logEvent("Error", `Error checking user: ${err.message}`, ip);
      return res.status(500).send("Error checking user.");
    }
    if (results.length > 0) {
      logEvent("Info", `User with email ${email} found.`, ip);
      res.json({ exists: true, userInfo: results[0] });
    } else {
      logEvent("Info", `User with email ${email} not found.`, ip);
      res.json({ exists: false });
    }

    // Send webhook
    const webhookData = {
      event: "user_checked",
      email: email,
      exists: results.length > 0,
      ip: ip,
    };
    sendToWebhook(webhookData);
  });
});

app.post("/storeAuthInfo", (req, res) => {
  const authInfo = req.body;
  const { id, email, name, gender, birthday, password } = authInfo;
  const ip = getClientIp(req); // Get the IP address of the client

  if (!id || !email || !name || !gender || !birthday || !password) {
    console.error("Missing required auth info fields:", authInfo);
    logEvent(
      "Error",
      `Missing required auth info fields: ${JSON.stringify(authInfo)}`,
      ip
    );
    return res.status(400).send("Missing required auth info fields.");
  }

  const insertQuery = `
    INSERT INTO users (id, email, name, gender, birthday, password)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    email = VALUES(email),
    name = VALUES(name),
    gender = VALUES(gender),
    birthday = VALUES(birthday),
    password = VALUES(password);
  `;

  db.query(
    insertQuery,
    [id, email, name, gender, birthday, password],
    (err, result) => {
      if (err) {
        console.error("Error storing or updating auth info:", err);
        logEvent(
          "Error",
          `Error storing or updating auth info: ${err.message}`,
          ip
        );
        return res.status(500).send("Error storing or updating auth info.");
      }
      logEvent(
        "Info",
        `Auth info for user ${email} stored/updated successfully.`,
        ip
      );
      res.send("Auth info received and stored/updated.");

      // Send webhook
      const webhookData = {
        event: "auth_info_stored",
        user: authInfo,
        ip: ip,
      };
      sendToWebhook(webhookData);
    }
  );
});

app.post("/storeToken", (req, res) => {
  const { id, token } = req.body;
  const ip = getClientIp(req); // Get the IP address of the client

  if (!id || !token) {
    console.error("Missing required token info fields:", { id, token });
    logEvent(
      "Error",
      `Missing required token info fields: ${JSON.stringify({ id, token })}`,
      ip
    );
    return res.status(400).send("Missing required token info fields.");
  }

  const updateQuery = `
    UPDATE users 
    SET token = ?
    WHERE id = ?
  `;

  db.query(updateQuery, [token, id], (err, result) => {
    if (err) {
      console.error("Error saving token:", err);
      logEvent(
        "Error",
        `Error saving token for user ${id}: ${err.message}`,
        ip
      );
      return res.status(500).send("Error saving token.");
    }
    logEvent("Info", `Token saved successfully for user ${id}.`, ip);
    res.send("Token saved successfully.");

    // Send webhook
    const webhookData = {
      event: "token_saved",
      user: { id, token },
      ip: ip,
    };
    sendToWebhook(webhookData);
  });
});

app.post("/updateProfile", (req, res) => {
  const {
    id,
    name,
    email,
    gender,
    birthday,
    password,
    profilepicture,
    countryCode,
    contact,
  } = req.body;
  const ip = getClientIp(req); // Get the IP address of the client

  const updateQuery = `
    UPDATE users 
    SET name = ?, email = ?, gender = ?, birthday = ?, password = ?, profilepicture = ?, countryCode = ?, contact = ?
    WHERE id = ?
  `;

  db.query(
    updateQuery,
    [
      name,
      email,
      gender,
      birthday,
      password,
      profilepicture,
      countryCode,
      contact,
      id,
    ],
    (err, result) => {
      if (err) {
        console.error("Error updating profile:", err);
        logEvent(
          "Error",
          `Error updating profile for user ${id}: ${err.message}`,
          ip
        );
        return res.status(500).send("Error updating profile.");
      }
      logEvent("Info", `Profile updated successfully for user ${id}.`, ip);
      res.send("Profile updated successfully.");

      // Send webhook
      const webhookData = {
        event: "profile_updated",
        user: {
          id,
          name,
          email,
          gender,
          birthday,
          profilepicture,
          countryCode,
          contact,
        },
        ip: ip,
      };
      sendToWebhook(webhookData);
    }
  );
});

app.post("/updateCompanyInfo", (req, res) => {
  const { email, orgName, position } = req.body;
  const ip = getClientIp(req); // Get the IP address of the client

  const updateQuery = `
    UPDATE users 
    SET orgName = ?, position = ?
    WHERE email = ?
  `;

  db.query(updateQuery, [orgName, position, email], (err, result) => {
    if (err) {
      console.error("Error updating company info:", err);
      logEvent(
        "Error",
        `Error updating company info for user ${email}: ${err.message}`,
        ip
      );
      return res.status(500).send("Error updating company info.");
    }
    logEvent(
      "Info",
      `Company info updated successfully for user ${email}.`,
      ip
    );
    res.send("Company info updated successfully.");

    // Send webhook
    const webhookData = {
      event: "company_info_updated",
      user: {
        email,
        orgName,
        position,
      },
      ip: ip,
    };
    sendToWebhook(webhookData);
  });
});

app.post("/saveDeviceDetails", (req, res) => {
  const {
    email,
    entityName,
    deviceIMEI,
    simICCId,
    batterySLNo,
    panelSLNo,
    luminarySLNo,
    mobileNo,
    district,
    panchayat,
    block,
    wardNo,
    poleNo,
    active,
    installationDate,
  } = req.body;
  const ip = getClientIp(req); // Get the IP address of the client

  const insertDeviceQuery = `
    INSERT INTO devices (
      email, entityName, deviceIMEI, simICCId, batterySLNo, panelSLNo, luminarySLNo, mobileNo, district, panchayat, block, wardNo, poleNo, active, installationDate
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    insertDeviceQuery,
    [
      email,
      entityName,
      deviceIMEI,
      simICCId,
      batterySLNo,
      panelSLNo,
      luminarySLNo,
      mobileNo,
      district,
      panchayat,
      block,
      wardNo,
      poleNo,
      active,
      installationDate,
    ],
    (err, result) => {
      if (err) {
        console.error("Error saving device details:", err);
        logEvent(
          "Error",
          `Error saving device details for user ${email}: ${err.message}`,
          ip
        );
        return res.status(500).send("Error saving device details.");
      }
      logEvent(
        "Info",
        `Device details saved successfully for user ${email}.`,
        ip
      );
      res.send("Device details saved successfully.");

      // Send webhook
      const webhookData = {
        event: "device_details_saved",
        device: {
          email,
          entityName,
          deviceIMEI,
          simICCId,
          batterySLNo,
          panelSLNo,
          luminarySLNo,
          mobileNo,
          district,
          panchayat,
          block,
          wardNo,
          poleNo,
          active,
          installationDate,
        },
        ip: ip,
      };
      sendToWebhook(webhookData);
    }
  );
});

app.get("/logs", (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get the page number from the query string
  const limit = parseInt(req.query.limit) || 10; // Get the limit from the query string
  const offset = (page - 1) * limit; // Calculate the offset for pagination

  const fetchLogsQuery = `SELECT timestamp, ip, eventType, eventDescription 
                          FROM logs 
                          ORDER BY timestamp DESC 
                          LIMIT ${limit} OFFSET ${offset}`; // Adjust query to use limit and offset
  const ip = getClientIp(req); // Get the IP address of the client

  console.log(`Executing query: ${fetchLogsQuery}`); // Log the query being executed

  db.query(fetchLogsQuery, (err, result) => {
    if (err) {
      console.error("Error fetching logs:", err);

      return res.status(500).send(`Error fetching logs: ${err.message}`);
    }
    res.json(result);
  });
});

app.get("/fetchToken/:email", (req, res) => {
  const { email } = req.params;
  const fetchTokenQuery = `
    SELECT token 
    FROM users 
    WHERE email = ?
  `;
  const ip = getClientIp(req); // Get the IP address of the client

  db.query(fetchTokenQuery, [email], (err, result) => {
    if (err) {
      console.error("Error fetching token:", err);
      logEvent(
        "Error",
        `Error fetching token for user ${email}: ${err.message}`,
        ip
      );
      return res.status(500).send("Error fetching token.");
    }

    if (result.length > 0) {
      logEvent("Info", `Token fetched successfully for user ${email}.`, ip);
      res.json({ token: result[0].token });
    } else {
      logEvent("Info", `No token found for user ${email}.`, ip);
      res.json({ token: null });
    }

    // Send webhook
    const webhookData = {
      event: "token_fetched",
      email: email,
      token: result.length > 0 ? result[0].token : null,
      ip: ip,
    };
    sendToWebhook(webhookData);
  });
});

app.post("/updateToken", (req, res) => {
  const { id, token } = req.body;
  const ip = getClientIp(req); // Get the IP address of the client

  if (!id || !token) {
    return res.status(400).send("User ID and token are required.");
  }

  const updateTokenQuery = "UPDATE users SET token = ? WHERE id = ?";

  db.query(updateTokenQuery, [token, id], (err, result) => {
    if (err) {
      console.error("Error updating token:", err);
      logEvent(
        "Error",
        `Error updating token for user ${id}: ${err.message}`,
        ip
      );
      return res.status(500).send("Error updating token.");
    }
    logEvent("Info", `Token updated successfully for user ${id}.`, ip);
    res.json({ message: "Token updated successfully." });

    // Send webhook for token update
    const webhookData = {
      event: "token_updated",
      user: { id },
      ip: ip,
    };
    sendToWebhook(webhookData);
  });
});

app.get("/getDevices", (req, res) => {
  const fetchDevicesQuery = "SELECT * FROM devices";
  const ip = getClientIp(req); // Get the IP address of the client

  db.query(fetchDevicesQuery, (err, results) => {
    if (err) {
      console.error("Error fetching devices:", err);
      logEvent("Error", `Error fetching devices: ${err.message}`, ip);
      return res.status(500).json({ error: "Error fetching devices." });
    }
    logEvent("Info", `Devices fetched successfully.`, ip);
    res.json(results);

    // Send webhook
    const webhookData = {
      event: "devices_fetched",
      ip: ip,
    };
    sendToWebhook(webhookData);
  });
});

app.get("/fetchCompanyInfo/:email", (req, res) => {
  const email = req.params.email;
  const ip = getClientIp(req); // Get the IP address of the client

  const fetchCompanyQuery =
    "SELECT orgName, position FROM users WHERE email = ?";
  db.query(fetchCompanyQuery, [email], (err, result) => {
    if (err) {
      console.error("Error fetching company info:", err);
      logEvent(
        "Error",
        `Error fetching company info for user ${email}: ${err.message}`,
        ip
      );
      return res.status(500).json({ error: "Internal server error" });
    }
    if (result.length === 0) {
      logEvent("Info", `Company info not found for user ${email}.`, ip);
      return res.status(404).json({ error: "Company info not found" });
    }

    const companyInfo = {
      orgName: result[0].orgName,
      position: result[0].position,
      // Add other fields if needed
    };

    logEvent(
      "Info",
      `Company info fetched successfully for user ${email}.`,
      ip
    );
    res.status(200).json(companyInfo);

    // Send webhook
    const webhookData = {
      event: "company_info_fetched",
      user: { email },
      companyInfo: companyInfo,
      ip: ip,
    };
    sendToWebhook(webhookData);
  });
});
app.get("/", function (req, res) {
  const ip = getClientIp(req); // Get the IP address of the client
  console.log(`Client IP address: ${ip}`);
  res.send(`Client IP address: ${ip}`);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
