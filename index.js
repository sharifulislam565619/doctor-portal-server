const admin = require("firebase-admin");
require('dotenv').config()
const express = require('express')
const { MongoClient } = require('mongodb');
const app = express()
const cors = require("cors")
const port = process.env.PORT || 5000
const ObjectId = require("mongodb").ObjectId
const fileUpload = require('express-fileupload')

app.use(cors())
app.use(express.json())
app.use(fileUpload())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2wssq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const stripe = require("stripe")(process.env.CLIENT_SECRET);




const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
   credential: admin.credential.cert(serviceAccount)
});



async function verifyToken(req, res, next) {
   if (req.headers?.authorization?.startsWith("Bearer ")) {
      token = await req.headers?.authorization?.split("Bearer ")[1]
      try {
         const decodedUser = await admin.auth().verifyIdToken(token)
         req.decodedEmail = decodedUser.email
      } catch {

      }
   }
   next()
}



async function run() {
   try {
      await client.connect()
      const database = client.db("doctor_portal")
      const appointmentCollection = database.collection("appointment")
      const userCollection = database.collection("users")
      const doctorsCollection = database.collection("doctors")

      app.post('/doctors', async (req, res) => {
         const name = req.body.name;
         const email = req.body.email;
         const pic = req.files.image;
         const picData = pic.data;
         const encodedPic = picData.toString('base64');
         const imageBuffer = Buffer.from(encodedPic, 'base64')
         const doc = {
            name,
            email,
            image: imageBuffer
         }
         const result = await doctorsCollection.insertOne(doc)
         res.json(result);
         console.log(result);
      })



      //get doctors data
      app.get("/doctors", async (req, res) => {
         const result = await doctorsCollection.find({}).toArray();
         res.json(result)
      })

      // insert a data
      app.post("/appointments", async (req, res) => {
         const doc = req.body;
         const result = await appointmentCollection.insertOne(doc);
         res.json(result)
         console.log(result);
      })

      //get a payment data
      app.get('/appointment/:id', async (req, res) => {
         const id = req.params.id
         const query = { _id: ObjectId(id) }
         const result = await appointmentCollection.findOne(query)
         res.json(result);
      })
      app.put('/appointment/:id', async (req, res) => {
         const id = req.params.id
         const payment = req.body;
         const query = { _id: ObjectId(id) }
         const updateDoc = {
            $set: {
               payment: payment
            }
         }
         const result = await appointmentCollection.updateOne(query, updateDoc)
         res.json(result);
      })

      // get all data by email and date
      app.get("/appointments", verifyToken, async (req, res) => {
         const email = req.query.email
         const date = req.query.date
         const query = { userEmail: email, date: date }
         const result = await appointmentCollection.find(query).toArray()
         res.json(result);
      })

      // check admin
      app.get("/users/:email", async (req, res) => {
         const email = req.params.email
         const filter = { email: email }
         const user = await userCollection.findOne(filter);
         let isAdmin = false;
         if (user.role === "Admin") {
            isAdmin = true
         }
         res.json({ admin: isAdmin })
      })

      // insert  a user
      app.post("/users", async (req, res) => {
         const user = req.body;
         const result = await userCollection.insertOne(user);
         res.json(result)
      })

      // update a user
      app.put("/users", async (req, res) => {
         const user = req.body;
         const filter = { email: user.email }
         const options = { upsert: true };
         const updateDoc = {
            $set: {
               user
            },
         };
         const result = await userCollection.updateOne(filter, updateDoc, options);
         res.json(result)
      })

      // update role
      app.put("/users/admin", verifyToken, async (req, res) => {
         const email = req.body.email;

         const requester = req.decodedEmail
         if (requester) {
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === "Admin") {
               const filter = { email: email }
               const updateDoc = {
                  $set: {
                     role: "Admin"
                  },
               };
               const result = await userCollection.updateOne(filter, updateDoc);
               res.json(result)
            }
         } else {
            res.status(403).json("You can not exist inside")
         }

      })

      // payment method
      app.post('/stripe.paymentIntents.create', async (req, res) => {
         const paymentInfo = req.body;
         const amount = paymentInfo.price * 100;
         const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            payment_method_types: [
               "card",
            ],
         });
         res.json({ clientSecret: paymentIntent.client_secret });
      })


   } finally {
      // await client.close()
   }
}
run().catch(console.dir())

app.get('/', (req, res) => {
   res.send('Hello doctor portal!')
})

app.listen(port, () => {
   console.log(`Server running ${port}`)
})