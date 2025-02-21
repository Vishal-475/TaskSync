require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
     credential: admin.credential.cert(serviceAccount)
 });
const { Firestore } = require('@google-cloud/firestore');
const db = admin.firestore();
const tasksCollection = db.collection('tasks'); // Make sure this line is present
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Route: Test Server
app.get('/', (req, res) => {
    res.send('TaskSync Backend is Running');
});

// Route: Fetch Weather Data
app.get('/weather', async (req, res) => {
    try {
        const { city } = req.query;
        const apiKey = process.env.WEATHER_API_KEY;
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
        const response = await axios.get(url);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching weather data' });
    }
});

app.post('/tasks', async (req, res) => {
    try {
        const { task, city, dueDate, reminder, status } = req.body;
        
        console.log("📥 Received Task:", { task, city, dueDate, reminder, status });

        if (!task) {
            console.error("❌ Error: Task is required!");
            return res.status(400).json({ error: "Task is required" });
        }

        const newTask = {
            task,
            city: city || "Not specified",
            dueDate: dueDate || null,
            reminder: reminder || null,
            status: status || "Pending",
            createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection('tasks').add(newTask);
        console.log("✅ Task Added with ID:", docRef.id);

        res.status(201).json({ success: true, id: docRef.id, ...newTask });
    } catch (error) {
        console.error("❌ Error adding task:", error);
        res.status(500).json({ error: "Error adding task", details: error.message });
    }
});





// Route: Get Tasks from Firestore
app.get('/tasks', async (req, res) => {
    try {
        const snapshot = await db.collection('tasks').get();
        let tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort tasks by reminder date & time (ascending order)
        tasks.sort((a, b) => new Date(`${a.dueDate} ${a.reminder}`) - new Date(`${b.dueDate} ${b.reminder}`));

        res.json(tasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).json({ error: "Error fetching tasks", details: error.message });
    }
});



app.put('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, dueDate, reminder } = req.body;

        const taskRef = tasksCollection.doc(id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            return res.status(404).json({ error: "Task not found" });
        }

        const updatedTask = {
            status: status || taskDoc.data().status,
            dueDate: new Date(dueDate || taskDoc.data().dueDate),
            reminder: new Date(reminder || taskDoc.data().reminder)
        };

        await taskRef.update(updatedTask);
        res.json({ message: "Task updated successfully" });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({ error: "Failed to update task" });
    }
});
const cron = require('node-cron');

// Schedule a task to check for reminders every minute
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const tasksSnapshot = await tasksCollection.where('reminder', '<=', now).get();
    tasksSnapshot.forEach(doc => {
        const task = doc.data();
        // Send reminder notification (e.g., email, SMS, etc.)
        console.log(`Reminder: ${task.task} is due soon!`);
    });
});





// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

app.get('/suggest-tasks', async (req, res) => {
    try {
        const { taskName, city, lat, lon } = req.query; // Get the task name and location info (city/coordinates)
        if (!taskName) {
            return res.status(400).json({ error: "Task name is required" });
        }

        // Step 1: Get Weather Data (Optional for location-specific context)
        let weatherResponse;
        if (city) {
            console.log(`Fetching weather for city: ${city}`);
            weatherResponse = await axios.get(
                `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_API_KEY}&units=metric`
            );
        } else if (lat && lon) {
            console.log(`Fetching weather for coordinates: lat=${lat}, lon=${lon}`);
            weatherResponse = await axios.get(
                `http://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.WEATHER_API_KEY}&units=metric`
            );
        }

        const weather = weatherResponse ? weatherResponse.data.weather[0].description : "Clear";
        const temperature = weatherResponse ? weatherResponse.data.main.temp : 20;

        // Step 2: Determine the context based on task name
        let suggestedTasks = [];

        // Task-based suggestions
        if (taskName.toLowerCase().includes("work") || taskName.toLowerCase().includes("project")) {
            suggestedTasks = [
                "Break your project into smaller, manageable tasks",
                "Set a deadline for each task in your project",
                "Create a project plan with milestones and deadlines",
                "Brainstorm new ideas for your project or task",
                "Prioritize the most important tasks first"
            ];
        } else if (taskName.toLowerCase().includes("study") || taskName.toLowerCase().includes("learn")) {
            suggestedTasks = [
                "Create a study schedule and break down your topics",
                "Review your notes from previous lessons",
                "Find relevant online courses or articles to deepen your knowledge",
                "Make flashcards for important terms and concepts",
                "Practice by teaching the topic to someone else"
            ];
        } else if (taskName.toLowerCase().includes("exercise") || taskName.toLowerCase().includes("workout")) {
            suggestedTasks = [
                "Start with a 15-minute warm-up session",
                "Try a new workout routine or fitness challenge",
                "Track your progress in a fitness app",
                "Stretch for 10 minutes before and after your workout",
                "Join a local fitness class or group workout"
            ];
        } else if (taskName.toLowerCase().includes("write") || taskName.toLowerCase().includes("blog")) {
            suggestedTasks = [
                "Write a compelling headline for your next blog post",
                "Research trending topics for your blog",
                "Create a content calendar for your blog posts",
                "Start outlining your next article or story",
                "Read a popular blog to get inspiration"
            ];
        } else if (taskName.toLowerCase().includes("clean") || taskName.toLowerCase().includes("organize")) {
            suggestedTasks = [
                "Tidy up your desk or workspace for better focus",
                "Organize your files into folders and categorize them",
                "Declutter your room by donating unused items",
                "Create a weekly cleaning schedule for the house",
                "Sort through old clothes and decide what to donate"
            ];
        } else if (taskName.toLowerCase().includes("cook") || taskName.toLowerCase().includes("recipe")) {
            suggestedTasks = [
                "Try a new recipe this weekend",
                "Prepare a meal plan for the week",
                "Experiment with a new type of cuisine",
                "Invite friends over for a dinner party",
                "Learn a quick 30-minute meal recipe"
            ];
        } else {
            suggestedTasks = [
                "Start by breaking the task into smaller steps",
                "Set a timer and work in 25-minute intervals",
                "Prioritize based on deadlines or importance",
                "Take breaks in between to stay refreshed",
                "Ask someone for help or feedback if needed"
            ];
        }

        // Step 3: Send suggestions based on task context
        res.json({ suggestedTasks, weather, temperature });
    } catch (error) {
        console.error("Error fetching task suggestions:", error);
        res.status(500).json({ error: "Failed to fetch task suggestions" });
    }
});




app.delete('/tasks/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const taskRef = db.collection("tasks").doc(id);
        const task = await taskRef.get();

        if (!task.exists) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        await taskRef.delete();
        res.json({ success: true, message: "Task deleted successfully!" });
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ success: false, message: "Failed to delete task" });
    }
});
