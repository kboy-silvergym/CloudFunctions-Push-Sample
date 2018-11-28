// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

import * as functions from 'firebase-functions';
import admin = require('firebase-admin');

var chatRef

admin.initializeApp(functions.config().firebase);

// TODO: uidを使ってuserのdatabaseを検索
const getTargetFcmToken = function (userId, callback) {
    console.log("getTargetFcmToken:");

    const rootRef = chatRef.root;
    const userRef = rootRef.child("users").child(userId);
    const fcmTokenRef = userRef.child("fcmToken");

    fcmTokenRef.once('value').then(function (snapshot) {
        const fcmToken = snapshot.val()

        console.log("return callback fcmToken:", fcmToken);
        callback(fcmToken);
    });
}

const getTargetUserId = function (userId, callback) {
    chatRef.once('value').then(function (snapshot) {
        const chatUserId = snapshot.val().userId;
        const chatUserName = snapshot.val().userName;

        const chatTrainerId = snapshot.val().trainerId;
        const chatTrainerName = snapshot.val().trainerName;

        let targetId;
        let userName;

        // idは自分ではない方を選択する
        // nameは送った人のものを返す
        if (userId === chatUserId) {
            targetId = chatTrainerId;
            userName = chatUserName;
        } else {
            targetId = chatUserId;
            userName = chatTrainerName;
        }
        console.log("targetId", targetId);
        callback(targetId, userName)
    });
}

exports.commentPush = functions.database.ref('/chats/{chatId}/chat/{commentId}')
    .onWrite((change, context) => {
        // Exit when the data is deleted.
        if (!change.after.exists()) {
            return null;
        }
        const item = change.after;
        chatRef = item.ref.parent.parent;
        const userId = item.child("userId").val();

        // トレーナーかユーザーかどちらかを判別する
        getTargetUserId(userId, function (targetId, userName) {
            // fcmTokenを取得
            getTargetFcmToken(targetId, function (token) {
                // 通知OFFのユーザーには通知を打たない
                if (token === null) {
                    return;
                }
                const comment = item.child("comment").val();

                // 通知のJSON
                const payload = {
                    notification: {
                        title: userName + "さん",
                        body: comment,
                        badge: "1",
                        sound: "default",
                    }
                };
                pushToDevice(token, payload);
            });
        });
    });

// 特定のfcmTokenに対してプッシュ通知を打つ
function pushToDevice(token, payload) {
    console.log("pushToDevice:", token);

    const options = {
        priority: "high",
    };
    admin.messaging().sendToDevice(token, payload, options)
        .then(pushResponse => {
            console.log("Successfully sent message:", pushResponse);
        })
        .catch(error => {
            console.log("Error sending message:", error);
        });
}

