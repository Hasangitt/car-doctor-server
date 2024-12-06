const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares

app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());


const logger = (req, res, next) =>{
 console.log('log info', req.method, req.url);
 next();
};

const verfiyToken = (req, res, next) => {
  const token = req?.cookies?.token;
  if(!token){
    return res.status(401).send('message', {message: 'unauthorized access'})
  }
  jwt.verify( token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if(err){
      return res.status(401).send({message: 'unauthorized access'})
    }
    req.user = decoded;
    next();
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pdldp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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

    const servicesCollection = client.db("carDoctor").collection("services");
    const checkoutCollection = client.db("carDoctor").collection("checkout");

    // jwt related api
    app.post("/jwt", async(req, res) => {
      const user = req.body;
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: "none"
      })
      .send({success: true})
    });

    app.post("/logout", async(req, res) => {
      const user = req.body;
      console.log('logout user', user)
      res.clearCookie('token', {maxAge: 0}).send({success: true})
    })

    // service related api

    app.get("/services", async (req, res) => {
      const cursor = servicesCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // app.get("/services/:id", async(req, res) => {
    //   const id = req.params.id;
    //   const query = {_id: new ObjectId(id)};
    //   const options = {
    //     projection: { title: 1, service_id: 1, price: 1, img: 1 },
    //   };
    //   const result = await servicesCollection.findOne(query, options);
    //   res.send(result)
    // });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.findOne(query);
      res.send(result);
    });

    // user checkout/bookings related api

    app.get("/checkout", logger, verfiyToken, async (req, res) => {
      console.log(req.query.email);
      console.log('coookies', req.user)
      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'forbidden'})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await checkoutCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/checkout", async (req, res) => {
      const order = req.body;
      const result = await checkoutCollection.insertOne(order);
      res.send(result);
    });

    app.delete("/checkout/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await checkoutCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/checkout/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateBooking = req.body;
      const updateDoc = {
        $set: {
          status: updateBooking.status,
        },
      };
      const result = await checkoutCollection.updateOne(filter, updateDoc);
      res.send(result);
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
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Car doctor server");
});

app.listen(port, () => {
  console.log(`car doctor server running on ${port}`);
});
