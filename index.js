const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const bodyParser = require('body-parser');
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;

//middleware
app.use(cors()
);
app.use(express.json());
app.use(bodyParser.json());

//mongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@personal.dp2qomu.mongodb.net/?retryWrites=true&w=majority&appName=personal`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const oldCarHat = async () => {
  try {
    //database name
    const database = client.db("oldCarHat");
    //database collection
    const productCollection = database.collection("products");
    const userCollection = database.collection("users");
    const categoryCollection = database.collection("categories");
    const orderCollection = database.collection("orders");
    const blogCollection = database.collection("blogs");
    const paymentCollection = database.collection("payments");

    // middlewares//
    //Verify JWT Token
    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.JWT_ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized Access" });
        }
        req.decoded = decoded;
        
        next();
      });
    };

    //Verify User role is Seller
    const verifySeller = async (req, res, next) => {
      const decoded = req.decoded;
      if (!decoded || !decoded.user) {
        return res.status(403).send({ message: "Access Forbidden" });
      }
      const sellerQuery = { uid: decoded.user };
      userCollection.findOne(sellerQuery).then((seller) => {
        if (!seller) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        if (seller.role !== "seller") {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        next();
      });
    };

    //Verify user role is Admin
    const verifyAdmin = (req, res, next) => {
      const decoded = req.decoded;
      if (!decoded || !decoded.user) {
        return res.status(403).send({ message: "Access Forbidden" });
      }
      const adminQuery = { uid: decoded.user };
      userCollection.findOne(adminQuery).then((admin) => {
        if (!admin) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        if (admin.role !== "admin") {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        next();
      });
    };

    //JWT Token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
        const token = jwt.sign(user, process.env.JWT_ACCESS_TOKEN, {
        expiresIn: process.env.JWT_SECRET_EXPIRESIN,
      });
       res.send({ token });
    });

       
    //products related API//
    //get all product created by seller
    app.get("/products", verifyToken, verifySeller, async (req, res) => {
      const decoded = req.decoded;
      const uid = req.params.uid;
      const query = { seller_uid: uid };
      if (uid !== decoded.uid) {
        return res.status(403).send({ message: "Access Forbidden" });
      }
      const result = await productCollection
        .find(query)
        .sort({ createAt: -1 })
        .toArray();
      res.send(result);
    });

    //get all product filter by category id
    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const query = { category_id: id };
      const result = await productCollection
        .find(query)
        .sort({ createAt: -1 })
        .toArray();
      res.send(result);
    });

    //post only seller created product
    app.post("/products", verifyToken, verifySeller, async (req, res) => {
      const decoded = req.decoded;
      const uid = req.params.uid;
      const product = req.body;
      if (uid !== decoded.uid) {
        return res.status(403).send({ message: "Access Forbidden" });
      }
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    //get all reported seller product
    app.get(
      "/reported-products/:uid",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        if (uid !== decoded.uid) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        const query = { reported: true };
        const result = await productCollection
          .find(query)
          .sort({ reportCount: 1 })
          .toArray();
        console.log("Query result:", result);
        res.send(result);
      }
    );

    //report a seller created product by buyer, only buyer can report
    app.patch("/report-product/:uid", verifyToken, async (req, res) => {
      const decoded = req.decoded;
      const uid = req.params.uid;
      const id = req.query.id;
      const prevReport = parseInt(req.query.reportCount);
      if (uid !== decoded.uid) {
        return res.status(403).send({ message: "Access Forbidden" });
      }
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          reported: true,
          reportCount: prevReport + 1,
        },
      };

      const result = await productCollection.updateOne(
        filter,
        updatedDoc,
        option
      );
      res.send(result);
    });

    //delete a product created by seller (delete by seller)
    app.delete(
      "/product-delete/:uid",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        const id = req.query.id;
        if (uid !== decoded.uid) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        const filter = { _id: new ObjectId(id) };
        const result = await productCollection.deleteOne(filter);
        res.send(result);
      }
    );

    //undo report given by buyer(Admin Only)
    app.patch(
      "/report-product-safe/:uid",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        const id = req.query.id;
        if (uid !== decoded.uid) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        const filter = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const updatedDoc = {
          $set: {
            reported: true,
            reportCount: prevReport + 1,
          },
        };
        const result = await productCollection.updateOne(
          filter,
          updatedDoc,
          option
        );
        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "Product not Found" });
        }
        res.send(result);
      }
    );

    //delete Reported product by admin
    app.delete(
      "/report-product-delete/:uid",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        const id = req.query.id;
        if (uid !== decoded.uid) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        const filter = { _id: new ObjectId(id) };
        const result = await productCollection.deleteOne(filter);
        res.send(result);
      }
    );

    //Category Related API//

    //get all category list
    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoryCollection
        .find(query)
        .sort({ category_name: 1 })
        .toArray();
      res.send(categories);
    });

    //create a category items by Seller
    app.post(
      "/categories",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        const new_category = req.body;
        if (uid !== decoded.uid) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        const result = await categoryCollection.insertOne(new_category);
        res.send(result);
      }
    );

    //User Related API//

    //saved new user data on database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { uid: user.uid };
      const userInDb = await userCollection.findOne(query);
      if (userInDb?.uid) {
        return res.send({ message: "User already exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //check user is Admin
    app.get("/user/admin/:uid", async (req, res) => {
      const uid = req.params.uid;
      const query = { uid };
      const user = await userCollection.findOne(query);
      res.send({ isAdmin: user?.role === "admin" ? true : false });
    });

    //check is user is buyer
    app.get("/user/buyer/:uid", async (req, res) => {
      const uid = req.params.uid;
      const query = { uid: uid };
      const user = await userCollection.findOne(query);
      res.send({ isBuyer: user?.role === "buyer" ? true : false });
    });

    //get all user data filter by their role
    app.get(
      "/users-by-role/:uid",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        const role = req.query.role;

        if (uid !== decoded.user) {
          return res.status(403).send({ message: "Access Forbidden" });
        }

        const query = { role };
        const users = await userCollection.find(query).toArray();
        console.log(users);
        res.send(users);
      }
    );

    // make seller verified
    app.patch(
      "/seller-verify/:uid",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        const id = req.query.id;

        if (uid !== decoded.user) {
          return res.status(403).send({ message: "Access Forbidden" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: "verified",
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .send({ message: "User not found or already verified" });
        }
        res.send(result);
      }
    );

    //checked user is Seller
    app.get("/user/seller/:uid", async (req, res) => {
      const uid = req.params.uid;
      const query = { uid: uid };
      const user = await userCollection.findOne(query);
      res.send({ isSeller: user?.role === "seller" ? true : false });
    });

    //checked Seller Verified
    app.get("/seller-verify/:uid", async (req, res) => {
      const uid = req.params.uid;
      const query = { uid: uid };
      const seller = await userCollection.findOne(query);
      res.send({
        isVerified: seller?.status === "verified" ? true : false,
      });
    });

    //delete user by admin
    app.delete(
      "/user-delete/:uid",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        const id = req.query.id;

        if (uid !== decoded.user) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        const filter = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(filter);
        console.log("Delete Result:", result);
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ message: "User not found or already deleted" });
        }
        res.send(result);
      }
    );

    //order related API//
    //get all order filter by user 
    app.get("/orders", async (req, res) => {
      const orders = await orderCollection.find().toArray();
      res.send(orders);
    });

    //get a single order by user uid and order id
      app.get('/order/:id', verifyToken, async (req, res) => {
      const { id } = req.params;
      const order = await orderCollection.findOne({ _id: new ObjectId(id) });
          if (order) {
              res.send({ success: true, data: order });
          } else {
              res.status(404).send({ success: false, message: 'Order not found' });
          }
   
  });

    //create a order by user
    app.post("/orders", verifyToken, async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.status(201).send(result);

      const productQuery = {
        _id:new ObjectId(order.product_info.product_id),
      };

      const option = { upsert: true };
      const orderedProduct = await productCollection.findOne(productQuery);
      console.log(option, orderedProduct);
    });

    //Promotion related API//

    //get All Promoted Product
    app.get("/promoted-product", async (req, res) => {
      const query = { promote: true };
      const result = await productCollection
        .find(query)
        .sort({ createAt: -1 })
        .toArray();
      res.send(result);
    });

    // make a product to promoted product
    app.patch(
      "/promote-product/:uid",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const decoded = req.decoded;
        const uid = req.params.uid;
        const id = req.query.id;
        if (uid !== decoded.uid) {
          return res.status(403).send({ message: "Access Forbidden" });
        }
        const filter = { _id: new ObjectId(id) };
        const option = { upsert: true };
        const updatedDoc = {
          $set: {
            promote: true,
          },
        };
        const result = await productCollection.updateOne(
          filter,
          updatedDoc,
          option
        );
        res.send(result);
      }
    );

    //Blog Related API//
    app.get("/blogs", async (req, res) => {
           const blogs = await blogCollection.find().toArray();
      res.send(blogs);
    });

    app.post("/blog", async (req, res) => {
      const blog = req.body;
      const result = await blogCollection.insertOne(blog);
      res.send(result);
    });

    //Payment Related API//
    //create Payment Intent
    app.post("/create-payment-intent/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const product = await productCollection.findOne(query);
      const price = product?.resell_price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    //save payment data to database
    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment);
          
      // Set order status to true after payment is done
      const orderQuery = { _id: new ObjectId(payment.orderId) };
      const orderUpdatedDoc = {
          $set: {
              order_status: true,
          },
      };
      const orderResult = await orderCollection.updateOne(orderQuery, orderUpdatedDoc);

      // Set product status to true and promote status to false after payment is done
      const productQuery = { _id: new ObjectId(payment.product_id) };
      const productUpdatedDoc = {
          $set: {
              order_status: true,
              promote: false,
          },
      };
      const productResult = await productCollection.updateOne(productQuery, productUpdatedDoc);

      res.send({ paymentResult: result, orderResult, productResult });

  });
  } finally {
    // await client.close();
  }
};
oldCarHat().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Welcome Everyone to OldCarHat!");
});

app.listen(port, () => {
  console.log(`OldCarHat app listening on port ${port}`);
});
