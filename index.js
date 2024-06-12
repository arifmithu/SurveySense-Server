const express = require("express");
require("dotenv").config();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const paymentCollection = client.db("SurveySense").collection("Payments");
    const feedbackOnUnpublishCollection = client
      .db("SurveySense")
      .collection("Feedback");
    const testimonialCollections = client
      .db("SurveySense")
      .collection("testimonials");

    //  ------------------jwt related api----------------
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //  ------------------user related api----------------
    // post user
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user, "user");
      const result = await userCollections.insertOne(user);
      res.send(result);
    });
    // get user
    app.get("/users/:email", async (req, res) => {
      const loggedEmail = req.params.email;
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
    // get surveys by category
    app.get("/surveys/all/:category", async (req, res) => {
      const surveyType = req.params.category;
      const sort = req.query.sortType;
      const query = { category: surveyType };
      if (surveyType == "all") {
        const result = await surveyCollections.find().toArray();
        if (sort == "ascending") {
          result.sort((a, b) => a.response - b.response);
          res.send(result);
        } else {
          result.sort((a, b) => b.response - a.response);
          res.send(result);
        }
      } else {
        const result = await surveyCollections.find(query).toArray();
        if (sort == "ascending") {
          result.sort((a, b) => a.response - b.response);
          res.send(result);
        } else {
          result.sort((a, b) => b.response - a.response);
          res.send(result);
        }
      }
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
    app.get("/surveys/:email", verifyToken, async (req, res) => {
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
    app.get("/surveys/voted/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { feedback: { $elemMatch: { email: email } } };
      const result = await surveyCollections.find(query).toArray();
      res.send(result);
    });

    // update survey by id
    app.put("/surveys/update/:id", verifyToken, async (req, res) => {
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
    app.put("/surveys/vote/:id", verifyToken, async (req, res) => {
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
    app.post("/reports", verifyToken, async (req, res) => {
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
    app.get("/surveys/reported/:email", verifyToken, async (req, res) => {
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
    app.post("/comments", verifyToken, async (req, res) => {
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

    // get user by role
    app.get("/users/all/:type", verifyToken, async (req, res) => {
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
    app.put("/users/targetUser/:id", verifyToken, async (req, res) => {
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

    //  ------------------testimonials related api----------------

    app.get("/testimonials", async (req, res) => {
      const result = await testimonialCollections.find().toArray();
      res.send(result);
    });

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      res.send({ paymentResult });
    });

    app.get("/payments", async (req, res) => {
      const payments = await paymentCollection.find().toArray();
      res.send(payments);
    });

    // feedback on unpublish surveys
    app.post("/feedbacks", async (req, res) => {
      const feedback = req.body;
      const result = await feedbackOnUnpublishCollection.insertOne(feedback);
      res.send(result);
    });
    // get feedbacks by email
    app.get("/feedbacks/:email", async (req, res) => {
      const loggedEmail = req.params.email;
      const query = { email: loggedEmail };
      const result = await feedbackOnUnpublishCollection.find(query).toArray();
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
