const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const moment = require("moment");
const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://surveysense-ec8e6.web.app",
      "https://surveysense-ec8e6.firebaseapp.com",
    ],
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.c4qvddn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const surveyCollections = client.db("SurveySense").collection("Surveys");
    const userCollections = client.db("SurveySense").collection("Users");
    const reportCollections = client.db("SurveySense").collection("Reports");
    const commentCollections = client.db("SurveySense").collection("Comments");

    //  ------------------jwt related api----------------
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //  ------------------user related api----------------
    // post user
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user, "user");
      const result = await userCollections.insertOne(user);
      res.send(result);
    });
    // get user role
    app.get("/users/:email", async (req, res) => {
      const loggedEmail = req.params.email;
      console.log("inside email api");
      const query = { email: loggedEmail };
      const result = await userCollections.findOne(query);
      res.send(result);
    });

    //  ------------------Survey related api----------------
    // post new survey to the database
    app.post("/surveys", async (req, res) => {
      const survey = req.body;
      const created = moment().format("MM/DD/YYYY");
      const finalSurvey = { ...survey, status: "published", created: created };
      const result = await surveyCollections.insertOne(finalSurvey);
      res.send(result);
    });

    // get all surveys
    app.get("/surveys", async (req, res) => {
      const result = await surveyCollections.find().toArray();
      res.send(result);
    });
    // get top 6 voted surveys
    app.get("/topSurveys", async (req, res) => {
      const topSurveys = await surveyCollections
        .find()
        .sort({ response: -1 })
        .limit(6)
        .toArray();
      res.send(topSurveys);
    });

    // get surveys of specific surveyor
    app.get("/surveys/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await surveyCollections.find(query).toArray();
      res.send(result);
    });

    // get survey by id
    app.get("/response/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await surveyCollections.findOne(query);
      res.send(result);
    });

    // participated surveys
    app.get("/surveys/voted/:email", async (req, res) => {
      const email = req.params.email;
      const query = { feedback: { $elemMatch: { email: email } } };
      const result = await surveyCollections.find(query).toArray();
      res.send(result);
    });

    // update survey by id
    app.put("/surveys/update/:id", async (req, res) => {
      const id = req.params.id;
      const survey = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedSurvey = {
        $set: {
          surveyName: survey.surveyName,
          title: survey.title,
          description: survey.description,
          options: survey.options,
          category: survey.category,
          deadline: survey.deadline,
          email: survey.email,
          response: survey.response,
          feedback: survey.feedback,
          status: survey.status,
          created: survey.created,
        },
      };
      const result = await surveyCollections.updateOne(query, updatedSurvey);
      res.send(result);
    });

    // voting api
    app.put("/surveys/vote/:id", async (req, res) => {
      const id = req.params.id;
      const vote = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $push: {
          feedback: vote,
        },
        $inc: { response: 1 },
      };
      const result = await surveyCollections.updateOne(query, updatedDoc);
      res.send(result);
    });

    // report survey
    app.post("/reports", async (req, res) => {
      const report = req.body;
      const query = { email: report.email, postId: report.postId };
      const alreadyReported = await reportCollections.findOne(query);
      if (alreadyReported) {
        res
          .status(400)
          .send({ message: "You have already reported this survey" });
      } else {
        const result = await reportCollections.insertOne(report);
        res.status(200).send(result);
      }
    });

    // get reported surveys
    app.get("/surveys/reported/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const reports = await reportCollections.find(query).toArray();
      const reportedSurveys = [];
      for (const e of reports) {
        const cursor = { _id: new ObjectId(e.postId) };
        const survey = await surveyCollections.findOne(cursor);
        reportedSurveys.push(survey);
      }
      res.send({ reportedSurveys, reports });
    });

    // post a comment
    app.post("/comments", async (req, res) => {
      const comment = req.body;
      const result = await commentCollections.insertOne(comment);
      res.send(result);
    });

    // get and show comments
    app.get("/comments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { postId: id };
      const result = await commentCollections.find(query).toArray();
      res.send(result);
    });

    // get all surveys where a specific pro user commented
    app.get("/comments/all/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const comments = await commentCollections.find(query).toArray();
      const commentedSurveys = [];
      for (const e of comments) {
        const cursor = { _id: new ObjectId(e.postId) };
        const survey = await surveyCollections.findOne(cursor);
        commentedSurveys.push(survey);
        console.log(cursor, "cursor");
      }
      res.send({ commentedSurveys, comments });
    });

    //  ------------------users related api----------------
    app.get("/users/all/:type", async (req, res) => {
      const usersType = req.params.type;
      console.log(usersType);
      const query = { role: usersType };
      if (usersType == "all") {
        const result = await userCollections.find().toArray();
        res.send(result);
      } else {
        const result = await userCollections.find(query).toArray();
        res.send(result);
      }
    });
    // get specific user to update status
    app.put("/users/targetUser/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: role.newRole,
        },
      };
      const result = await userCollections.updateOne(query, updatedDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

app.get("/", (req, res) => {
  res.send("SurveySense server is running!");
});

app.listen(port, () => {
  console.log(`SurveySense is listening on port ${port}`);
});
