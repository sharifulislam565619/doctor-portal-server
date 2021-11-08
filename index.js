const admin = require("firebase-admin");
require('dotenv').config()
const express = require('express')
const { MongoClient } = require('mongodb');
const app = express()
const cors = require("cors")
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2wssq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


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

      // insert a data
      app.post("/appointments", async (req, res) => {
         const doc = req.body;
         const result = await appointmentCollection.insertOne(doc);
         res.json(result)
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
         console.log(result);
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