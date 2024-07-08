// Global variable to store user email
let userEmail = "";
let userProfilePicture = "";
// Function to initiate Google Sign-In
function signIn() {
  let oauth2Endpoint = "https://accounts.google.com/o/oauth2/v2/auth";
  let form = document.createElement("form");
  form.setAttribute("method", "GET");
  form.setAttribute("action", oauth2Endpoint);

  let params = {
    client_id:
      "174612712651-5rq4a1uco3ftc60t49jvvvpj4l8ikg5m.apps.googleusercontent.com",
    redirect_uri: "http://127.0.0.1:5501/dashboard.html",
    response_type: "token",
    scope:
      "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/user.birthday.read https://www.googleapis.com/auth/user.gender.read",
    include_granted_scopes: "true",
    state: "pass-through-value",
  };

  for (let p in params) {
    let input = document.createElement("input");
    input.setAttribute("type", "hidden");
    input.setAttribute("name", p);
    input.setAttribute("value", params[p]);
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

// Function to parse URL parameters
function getParams() {
  const params = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.substring(1));
  let paramObj = {};

  for (let [key, value] of params.entries()) {
    paramObj[key] = value;
  }

  for (let [key, value] of fragment.entries()) {
    paramObj[key] = value;
  }

  return paramObj;
}

// Function to store authentication information in localStorage
function storeAuthInfo(params) {
  if (Object.keys(params).length > 0) {
    localStorage.setItem("authinfo", JSON.stringify(params));
    console.log("Auth info stored:", params);
  } else {
    console.log("No URL parameters to store.");
  }
}

// Function to load authentication information from localStorage
function loadAuthInfo() {
  const info = JSON.parse(localStorage.getItem("authinfo"));
  if (!info) {
    console.error("No auth information found in localStorage.");
    return null;
  }
  console.log("Auth info loaded:", info);
  return info;
}

// Function to send authentication information to the server
function sendAuthInfoToServer(authInfo) {
  const emailToSend = authInfo.email || userEmail; // Use userEmail if authInfo.email is undefined

  fetch("http://localhost:3001/checkUser", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: emailToSend }), // Ensure email is included
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.exists) {
        console.log("User exists in database, fetching stored data...");
        displayUserInfo(data.userInfo); // Display stored user info
      } else {
        console.log("User does not exist, storing new user data...");
        fetch("http://localhost:3001/storeAuthInfo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(authInfo),
        })
          .then((response) => response.text())
          .then((data) => {
            console.log("Server response:", data);
            displayUserInfo(authInfo);
            displayCompanyInfo(); // Display new user info
          })
          .catch((error) => {
            console.error("Error sending auth info to server:", error);
          });
      }
    })
    .catch((error) => {
      console.error("Error checking user in database:", error);
    });
}

// Function to fetch user info from Google API
function fetchUserInfo(token) {
  fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((response) => response.json())
    .then((userInfo) => {
      console.log("User info fetched:", userInfo);
      // Set global variable
      userEmail = userInfo.email;
      userProfilePicture = userInfo.picture;
      fetchAdditionalUserInfo(token, userInfo);
    })
    .catch((error) => {
      console.error("Error fetching user info:", error);
    });
}

// Function to fetch additional user info (gender and birthday) from Google API
function fetchAdditionalUserInfo(token, userInfo) {
  fetch(
    `https://people.googleapis.com/v1/people/me?personFields=genders,birthdays`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )
    .then((response) => response.json())
    .then((data) => {
      console.log("Additional user info fetched:", data);

      const gender =
        data.genders && data.genders.length > 0 ? data.genders[0].value : "N/A";
      const birthday =
        data.birthdays && data.birthdays.length > 0
          ? data.birthdays[0].date
          : "N/A";

      // Format birthday to YYYY-MM-DD
      const formattedBirthday = birthday
        ? `${birthday.year}-${String(birthday.month).padStart(2, "0")}-${String(
            birthday.day
          ).padStart(2, "0")}`
        : "";

      const completeUserInfo = {
        ...userInfo,
        gender,
        birthday: formattedBirthday,
        profilepicture: userInfo.picture, // Assuming profile picture URL from Google userInfo
        password: "YourDefaultPassword", // Replace with actual password logic
      };

      sendAuthInfoToServer(completeUserInfo);
      displayUserInfo(completeUserInfo);
    })
    .catch((error) => {
      console.error("Error fetching additional user info:", error);
    });
}

// Function to initialize Google Auth
function initGoogleAuth() {
  gapi.load("auth2", function () {
    gapi.auth2
      .init({
        client_id:
          "174612712651-5rq4a1uco3ftc60t49jvvvpj4l8ikg5m.apps.googleusercontent.com", // Replace with your client ID
      })
      .then(function () {
        console.log("Google Auth initialized.");
      });
  });
}
// Assuming you have the imageURL fetched from your database or API
// Replace with actual image URL

// Function to sign out user and revoke token
function signOut() {
  const authInfo = loadAuthInfo();
  if (!authInfo) {
    console.error("No auth information found.");
    return;
  }
  const token = authInfo.access_token;

  // Revoke the token
  fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
    method: "POST",
    headers: {
      "Content-type": "application/x-www-form-urlencoded",
    },
  })
    .then((response) => {
      if (response.ok) {
        console.log("Token revoked.");
        // Sign out from Google and remove auth info from localStorage
        const auth2 = gapi.auth2.getAuthInstance();
        auth2
          .signOut()
          .then(function () {
            console.log("User signed out.");
            localStorage.removeItem("authinfo");
            window.location.href = "https://kumaraman6723.github.io"; // Redirect to login page
          })
          .catch((error) => {
            console.error("Error signing out:", error);
            // Redirect to login page in case of an error during sign-out
            window.location.href = "https://kumaraman6723.github.io";
          });
      } else {
        console.error("Error revoking token:", response.statusText);
        // Redirect to login page even if token revocation fails
        window.location.href = "https://kumaraman6723.github.io";
      }
    })
    .catch((error) => {
      console.error("Error revoking token:", error);
      // Redirect to login page in case of an error during token revocation
      window.location.href = "https://kumaraman6723.github.io";
    });
}
document.addEventListener("DOMContentLoaded", function () {
  var input = document.querySelector("#Contact");
  var iti = window.intlTelInput(input, {
    separateDialCode: true,
    initialCountry: "auto",
    utilsScript: "path/to/intl-tel-input/js/utils.js",
  });

  input.addEventListener("countrychange", function () {
    var countryCode = iti.getSelectedCountryData().dialCode;
    document.getElementById("countryCode").value = countryCode;
  });
});

// Function to update user profile
function updateProfile() {
  const authInfo = loadAuthInfo();
  if (!authInfo) {
    console.error("No auth information found.");
    return;
  }

  // Fetching profile ID from DOM
  const profileId = document.getElementById("id").value;

  const updatedProfile = {
    id: profileId,
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    gender: document.getElementById("gender").value,
    birthday: document.getElementById("birthday").value, // Use directly if already in YYYY-MM-DD format
    password: document.getElementById("password").value,
    contact: document.getElementById("Contact").value,
    countryCode: document.getElementById("countryCode").value, // Country code from hidden input
    profilepicture: document.getElementById("image").src, // Profile picture URL
  };

  console.log("Updated Profile:", updatedProfile); // Check if this logs the correct updated profile

  fetch("http://localhost:3001/updateProfile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedProfile),
  })
    .then((response) => response.text())
    .then((data) => {
      console.log("Profile updated:", data);
      alert("Profile updated successfully!");
      // Optionally update the displayed user info
      displayUserInfo(updatedProfile);
    })
    .catch((error) => {
      console.error("Error updating profile:", error);
      alert("Failed to update profile. Please try again.");
    });
}

// Function to display user information in the form fields
function displayUserInfo(userInfo) {
  document.getElementById("id").value = userInfo.id;
  document.getElementById("name").value = userInfo.name;
  document.getElementById("email").value = userInfo.email;
  document.getElementById("gender").value = userInfo.gender;

  // Format the birthday using Moment.js
  const formattedBirthday = userInfo.birthday
    ? moment(userInfo.birthday).format("YYYY-MM-DD")
    : "";
  document.getElementById("birthday").value = formattedBirthday;

  // Set the profile picture

  document.getElementById("image").src = userInfo.profilepicture;
  userProfilePicture = userInfo.profilepicture;
  document.getElementById("Contact").value = userInfo.contact;
  document.getElementById("countryCode").value = userInfo.countryCode || "";

  // Replace 'profilepicture' with the actual key from userInfo
  console.log(userInfo.countryCode);
}
document.addEventListener("DOMContentLoaded", function () {
  // Your code here, including accessing and setting 'image' element properties
  document.getElementById("user-profile-picture").src = userProfilePicture;
});

// Function to generate token using Spring Boot API
async function generateToken() {
  const tokenLength = 10;
  let token = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < tokenLength; i++) {
    const index = Math.floor(Math.random() * characters.length);
    token += characters.charAt(index);
  }

  // Display the generated token
  document.getElementById("token-display").innerHTML =
    "<strong>Generated Token:</strong> " + token;

  // Optionally, you can store the generated token in the database here
  try {
    await storeTokenInDatabase(token, userEmail);
  } catch (error) {
    console.error("Error storing token in the database:", error);
  }
}

// Function to update token from database
async function updateToken() {
  try {
    const authInfo = loadAuthInfo();
    if (!authInfo) {
      console.error("No auth information found.");
      return;
    }

    // Fetch token from the database
    const tokenFromDB = await fetchTokenFromDatabase(userEmail);
    if (!tokenFromDB) {
      alert("No token found in database. Please generate a new token.");
      return;
    }

    const newToken = prompt("Enter new Token value:");
    if (!newToken) return;

    // Update token in the UI
    document.getElementById("token-display").innerHTML =
      "<strong>Updated Token:</strong> " + newToken;

    // Optionally, you can update the token in the database here
    updateTokenInDatabase(newToken, userEmail);
  } catch (error) {
    console.error("Error updating token:", error);
  }
}

// Function to store token in database
async function storeTokenInDatabase(token, email) {
  try {
    const response = await fetch("http://localhost:3001/storeToken", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, email }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    console.log("Token stored in database successfully.");
  } catch (error) {
    console.error("Error storing token in database:", error);
  }
}

// Function to fetch token from database
async function fetchTokenFromDatabase(email) {
  try {
    const response = await fetch(`http://localhost:3001/fetchToken/${email}`);

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const tokenEntity = await response.json();
    return tokenEntity.token;
  } catch (error) {
    console.error("Error fetching token from database:", error);
    return null;
  }
}

// Function to update token in database
async function updateTokenInDatabase(token, email) {
  try {
    const response = await fetch(`http://localhost:3001/updateToken/${email}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    console.log("Token updated in database successfully.");
  } catch (error) {
    console.error("Error updating token in database:", error);
  }
}

// Function to update company info
function updateCompanyInfo() {
  const updatedCompanyInfo = {
    orgName: document.getElementById("orgName").value,
    position: document.getElementById("position").value,
    // Add other fields as needed
  };

  console.log("Updated Company Info:", updatedCompanyInfo);

  const authInfo = loadAuthInfo();
  if (!authInfo) {
    console.error("No auth information found.");
    return;
  }

  fetch("http://localhost:3001/updateCompanyInfo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: userEmail,
      orgName: updatedCompanyInfo.orgName,
      position: updatedCompanyInfo.position,
    }),
  })
    .then((response) => response.text())
    .then((data) => {
      console.log("Company info updated:", data);
      console.log(userEmail);
      alert("Company info updated successfully!");
      // Optionally update the displayed company info
      displayCompanyInfo();
    })
    .catch((error) => {
      console.error("Error updating company info:", error);
      alert("Failed to update company info. Please try again.");
    });
}

// Function to display company information in the form fields
// Function to display company information fetched from the database
// Function to display company information in the form fields
function displayCompanyInfo() {
  fetch(`http://localhost:3001/fetchCompanyInfo/${userEmail}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((companyInfo) => {
      document.getElementById("orgName").value = companyInfo.orgName;
      document.getElementById("position").value = companyInfo.position;
      // Set other fields as needed
      console.log("Company info fetched:", companyInfo);
    })
    .catch((error) => {
      console.error("Error fetching company info:", error);
      // Handle error scenario or display default values
      document.getElementById("orgName").value = "";
      document.getElementById("position").value = "";
      // Clear other fields as needed or set default values
    });
}

// Initialization on page load
window.onload = function () {
  const params = getParams();
  storeAuthInfo(params);
  const authInfo = loadAuthInfo();
  if (authInfo) {
    // Fetch user info from backend (if needed)
    fetchUserInfo(authInfo["access_token"]);
  } else {
    console.error("No authentication information found.");
  }
};
const sideLinks = document.querySelectorAll(
  ".sidebar .side-menu li a:not(.logout)"
);

sideLinks.forEach((item) => {
  const li = item.parentElement;
  item.addEventListener("click", () => {
    sideLinks.forEach((i) => {
      i.parentElement.classList.remove("active");
    });
    li.classList.add("active");
  });
});

const menuBar = document.querySelector(".content nav .bx.bx-menu");
const sideBar = document.querySelector(".sidebar");

menuBar.addEventListener("click", () => {
  sideBar.classList.toggle("close");
});

const searchBtn = document.querySelector(
  ".content nav form .form-input button"
);
const searchBtnIcon = document.querySelector(
  ".content nav form .form-input button .bx"
);
const searchForm = document.querySelector(".content nav form");

searchBtn.addEventListener("click", function (e) {
  if (window.innerWidth < 576) {
    e.preventDefault;
    searchForm.classList.toggle("show");
    if (searchForm.classList.contains("show")) {
      searchBtnIcon.classList.replace("bx-search", "bx-x");
    } else {
      searchBtnIcon.classList.replace("bx-x", "bx-search");
    }
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth < 768) {
    sideBar.classList.add("close");
  } else {
    sideBar.classList.remove("close");
  }
  if (window.innerWidth > 576) {
    searchBtnIcon.classList.replace("bx-x", "bx-search");
    searchForm.classList.remove("show");
  }
});

const toggler = document.getElementById("theme-toggle");

toggler.addEventListener("change", function () {
  if (this.checked) {
    document.body.classList.add("dark");
  } else {
    document.body.classList.remove("dark");
  }
});
function showContent(sectionId) {
  // Hide all content sections
  document.querySelectorAll(".content-section").forEach(function (section) {
    section.style.display = "none";
  });

  // Show the selected content section
  document.getElementById(sectionId).style.display = "block";
}

// Add event listeners to sidebar links
document
  .getElementById("dashboard-link")
  .addEventListener("click", function () {
    showContent("dashboard-content");
  });
document.getElementById("shop-link").addEventListener("click", function () {
  showContent("shop-content");
});
document
  .getElementById("analytics-link")
  .addEventListener("click", function () {
    showContent("analytics-content");
  });
document.getElementById("tickets-link").addEventListener("click", function () {
  showContent("tickets-content");
});

document.getElementById("settings-link").addEventListener("click", function () {
  showContent("settings-content");
});
document
  .getElementById("add-device-link")
  .addEventListener("click", function () {
    showContent("device-content");
  });

// Default content to show on page load
showContent("dashboard-content");
document.getElementById("clickable-div").addEventListener("click", function () {
  const displayTextDiv = document.getElementById("display-text");
  displayTextDiv.style.display = "block";
  displayTextDiv.innerHTML = "<p>You clicked on the left-side div!</p>";
});

document.getElementById("clickable-div").addEventListener("click", function () {
  const displayTextDiv = document.getElementById("display-text");
  displayTextDiv.style.display = "block";
  displayTextDiv.innerHTML = "<p>You clicked on the left-side div!</p>";
});

document.addEventListener("DOMContentLoaded", function () {
  const url = "http://127.0.0.1:5500/jsonData.json";

  axios
    .get(url)
    .then((response) => {
      const data = response.data;
      processChartData(data);
    })
    .catch((error) => {
      console.error("Error fetching data: ", error);
    });

  function processChartData(data) {
    // Extracting data for charts
    const labels = []; // Use appropriate labels
    const voltageData = [];
    const currentData = [];
    const powerData = [];
    const brightnessData = [];
    const batteryData = [];

    // Assuming `data` contains an array of records
    data.forEach((record) => {
      labels.push(record.date); // Use the date field

      voltageData.push(record.PV);
      currentData.push(record.PC);
      powerData.push(record.PP);
      brightnessData.push(record.BrL);
      batteryData.push(record.BTem);
    });

    createChart(
      "voltageChart",
      "Voltage",
      labels,
      voltageData,
      "Voltage (V)",
      "voltageTable"
    );
    createChart(
      "currentChart",
      "Current",
      labels,
      currentData,
      "Current (A)",
      "currentTable"
    );
    createChart(
      "powerChart",
      "Power",
      labels,
      powerData,
      "Power (W)",
      "powerTable"
    );
    createChart(
      "brightnessChart",
      "Brightness Level",
      labels,
      brightnessData,
      "Brightness (%)",
      "brightnessTable"
    );
    createChart(
      "batteryChart",
      "Battery Temperature",
      labels,
      batteryData,
      "Temperature (°C)",
      "batteryTable"
    );
  }

  function createChart(chartId, title, labels, data, yAxisLabel, tableId) {
    const ctx = document.getElementById(chartId).getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: title,
            data: data,
            borderColor: "rgba(75, 192, 192, 1)",
            borderWidth: 1,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        title: {
          display: true,
          text: title,
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
            },
            title: {
              display: true,
              text: "Date",
            },
          },
          y: {
            title: {
              display: true,
              text: yAxisLabel,
            },
          },
        },
      },
    });

    createTable(tableId, labels, data, title);
  }

  function createTable(tableId, labels, data, title) {
    const tableContainer = document.getElementById(tableId);
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");

    // Create header row
    const headerRow = document.createElement("tr");
    const dateHeader = document.createElement("th");
    dateHeader.textContent = "Date";
    const dataHeader = document.createElement("th");
    dataHeader.textContent = title;
    headerRow.appendChild(dateHeader);
    headerRow.appendChild(dataHeader);
    thead.appendChild(headerRow);

    // Create data rows
    for (let i = 0; i < labels.length; i++) {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      dateCell.textContent = labels[i];
      const dataCell = document.createElement("td");
      dataCell.textContent = data[i];
      row.appendChild(dateCell);
      row.appendChild(dataCell);
      tbody.appendChild(row);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    tableContainer.appendChild(table);
  }

  // Navigation logic
  const sections = {
    "dashboard-link": "dashboard-content",
    "shop-link": "shop-content",
    "analytics-link": "analytics-content",
    "tickets-link": "tickets-content",
    "settings-link": "settings-content",
    "add-device-link": "device-content",
    "view-device-link": "view-device-content",
  };

  document.querySelectorAll(".side-menu a").forEach((link) => {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      document.querySelectorAll(".content-section").forEach((section) => {
        section.style.display = "none";
      });
      document.getElementById(sections[this.id]).style.display = "block";
    });
  });
});
function saveDeviceData() {
  const entityName = document.getElementById("entityName").value;
  const deviceIMEI = document.getElementById("deviceIMEI").value;
  const simICCId = document.getElementById("simICCId").value;
  const batterySLNo = document.getElementById("batterySLNo").value;
  const panelSLNo = document.getElementById("panelSLNo").value;
  const luminarySLNo = document.getElementById("luminarySLNo").value;
  const mobileNo = document.getElementById("mobileNo").value;
  const district = document.getElementById("district").value;
  const panchayat = document.getElementById("panchayat").value;
  const block = document.getElementById("block").value;
  const wardNo = document.getElementById("wardNo").value;
  const poleNo = document.getElementById("poleNo").value;
  const active = document.getElementById("active").value;
  const installationDate = document.getElementById("installationDate").value;

  if (
    !entityName ||
    !deviceIMEI ||
    !simICCId ||
    !batterySLNo ||
    !panelSLNo ||
    !luminarySLNo ||
    !mobileNo ||
    !district ||
    !panchayat ||
    !block ||
    !wardNo ||
    !poleNo ||
    !installationDate
  ) {
    alert("Please enter all required fields.");
    return;
  }

  const deviceData = {
    email: userEmail, // Replace with the actual email variable
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
  };

  console.log("Saving device data:", deviceData);

  // Send device data to the server
  fetch("http://localhost:3001/storeDeviceInfo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deviceData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Device data saved:", data);
      alert("Device data saved successfully!");
      // Optionally clear form fields after saving
      document.getElementById("device-form").reset();
    })
    .catch((error) => {
      console.error("Error saving device data:", error);
      alert("Failed to save device data. Please try again.");
    });
}

document
  .getElementById("view-device-link")
  .addEventListener("click", function () {
    showContent("view-device-content");
    fetchDeviceData();
  });

document
  .getElementById("device-form")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    saveDeviceData();
  });

function fetchDeviceData() {
  fetch("http://localhost:3001/getDevices")
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      return response.json();
    })
    .then((devices) => {
      const deviceList = document.getElementById("device-list");
      deviceList.innerHTML = "";

      devices.forEach((device) => {
        const deviceDiv = document.createElement("div");
        deviceDiv.className = "device";
        deviceDiv.innerHTML = `
          <h3>${device.entityName}</h3>
          <p><strong>Device IMEI:</strong> ${device.deviceIMEI}</p>
          <p><strong>SIM ICC ID:</strong> ${device.simICCId}</p>
          <p><strong>Battery SL No:</strong> ${device.batterySLNo}</p>
          <p><strong>Panel SL No:</strong> ${device.panelSLNo}</p>
          <p><strong>Luminary SL No:</strong> ${device.luminarySLNo}</p>
          <p><strong>Mobile No:</strong> ${device.mobileNo}</p>
          <p><strong>District:</strong> ${device.district}</p>
          <p><strong>Panchayat:</strong> ${device.panchayat}</p>
          <p><strong>Block:</strong> ${device.block}</p>
          <p><strong>Ward No:</strong> ${device.wardNo}</p>
          <p><strong>Pole No:</strong> ${device.poleNo}</p>
          <p><strong>Active:</strong> ${device.active}</p>
          <p><strong>Installation Date:</strong> ${device.installationDate}</p>
        `;
        deviceList.appendChild(deviceDiv);
      });
    })
    .catch((error) => {
      console.error("Error fetching device data:", error);
      alert("Failed to fetch device data. Please try again.");
    });
}
document.getElementById("dashboard-link").addEventListener("click", () => {
  showContent("dashboard-content");
});

document.getElementById("user-activity-link").addEventListener("click", () => {
  showContent("user-activity-content");
});

document.getElementById("settings-link").addEventListener("click", () => {
  showContent("settings-content");
});

function showContent(sectionId) {
  const sections = document.querySelectorAll(".content-section");
  sections.forEach((section) => {
    section.style.display = "none";
  });
  document.getElementById(sectionId).style.display = "block";
}
function adminLogin(event) {
  event.preventDefault(); // Prevent the default form submission
  const adminUserId = document.getElementById("adminUserId").value;
  const adminPassword = document.getElementById("adminPassword").value;

  // Perform validation and authentication (this is just a basic example)
  if (adminUserId === "admin" && adminPassword === "admin123") {
    // Redirect to the admin dashboard
    window.location.href = "Admindashboard.html";
  } else {
    alert("Invalid admin credentials");
  }
}
