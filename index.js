const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
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
    await client.connect();

    const surveyCollections = client.db("SurveySense").collection("Surveys");
    const userCollections = client.db("SurveySense").collection("Users");

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

    // update survey by id
    app.put("surveys/update/:id", async (req, res) => {
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
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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
