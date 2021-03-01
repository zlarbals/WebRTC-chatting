const mediaStreamConstraints = {
  video: true,
  audio: true,
};

const offerOptions = {
  offerToReceiveVideo: 1,
};

const localVideo = document.getElementById("localVideo");
let localStream;
let localUserId;
let connections = [];

function gotRemoteStream(event, userId) {
  let remoteVideo = document.createElement("video");

  remoteVideo.setAttribute("data-socket", userId);
  remoteVideo.srcObject = event.stream;
  remoteVideo.autoplay = true;
  // remoteVideo.muted       = true;
  remoteVideo.playsinline = true;
  //videos 클래스에 remoteVideo 붙임.
  document.querySelector(".videos").appendChild(remoteVideo);
}

function startLocalStream() {
  //mediaDevice 객체의 getUserMedia를 통해서 사용자의 미디어 데이터를 스트림으로 받아옴.
  navigator.mediaDevices
    .getUserMedia(mediaStreamConstraints)
    .then(getUserCam) //getUserCam을 통해 비디오를 자신의 캠으로 지정.
    .then(connectSocketToSignaling)
    .catch(handleError);
}

function connectSocketToSignaling() {
  //서버와 연결.
  const socket = io.connect("http://localhost:3000", { secure: true });

  socket.on("connect", () => {
    //본인의 소켓 id
    localUserId = socket.id;
    console.log("localUser", localUserId);

    //서버에서 user-joined를 보내오면
    socket.on("user-joined", (data) => {
      //나를 포함한 clients
      const clients = data.clients;
      const joinedUserId = data.joinedUserId;
      console.log(joinedUserId, " joined");

      //clients가 배열이고 길이가 0보다 클 때.
      if (Array.isArray(clients) && clients.length > 0) {
        clients.forEach((userId) => {
          //userID가 connection에 없는 경우, 즉 처음들어온 경우.
          if (!connections[userId]) {
            //RTCPeerConnection 객체 생성
            connections[userId] = new RTCPeerConnection(mediaStreamConstraints);
            //icecandidate 이벤트 발생할 때 호출함 함수 설정.
            connections[userId].onicecandidate = (event) => {
              //iceCandidate할 대상이 생기면
              if (event.candidate) {
                console.log(socket.id, " Send candidate to ", userId);
                //type을 candidate로 함으로써 상대방 peer가 내 stream에 연결할 수 있도록 한다.
                socket.emit("signaling", {
                  type: "candidate",
                  candidate: event.candidate,
                  toId: userId,
                });
              }
            };

            //addstream 이벤트 발생할 때 실행할 메서드 설정.
            connections[userId].onaddstream = (event) => {
              gotRemoteStream(event, userId);
            };

            //connections[userId].onaddstream
            //비디오 보여줌.
            connections[userId].addStream(localStream);
          }
        });

        //client가 2명 이상이면.
        if (data.count >= 2) {
          //description 교환. 나의 비디오가 상대방한테, 상대방의 비디오가 나한테 보여지는 과정.
          connections[joinedUserId]
            .createOffer(offerOptions) // 수신자한테 전달함 sdp 생성.
            .then((description) => {
              connections[joinedUserId]
                .setLocalDescription(description)
                .then(() => {
                  console.log(socket.id, " Send offer to ", joinedUserId);
                  socket.emit("signaling", {
                    type: "sdp",
                    toId: joinedUserId,
                    description: connections[joinedUserId].localDescription,
                  });
                })
                .catch(handleError);
            });
        }
      }
    });

    socket.on("user-left", (userId) => {
      let video = document.querySelector('[data-socket="' + userId + '"]');
      video.parentNode.removeChild(video);
    });

    socket.on("signaling", (data) => {
      gotMessageFromSignaling(socket, data);
    });
  });
}

function gotMessageFromSignaling(socket, data) {
  const fromId = data.fromId;

  //id가 다를 경우에만 즉, 내가 아닌 경우에만
  if (fromId !== localUserId) {
    switch (data.type) {
      case "candidate":
        console.log(socket.id, " Receive Candidate from ", fromId);
        if (data.candidate) {
          //브라우저에 연결
          gotIceCandidate(fromId, data.candidate);
        }
        break;

      case "sdp":
        //sdp 교환
        if (data.description) {
          console.log(socket.id, " Receive sdp from ", fromId);
          connections[fromId]
            .setRemoteDescription(new RTCSessionDescription(data.description))
            .then(() => {
              if (data.description.type === "offer") {
                connections[fromId]
                  .createAnswer()
                  .then((description) => {
                    connections[fromId]
                      .setLocalDescription(description)
                      .then(() => {
                        console.log(socket.id, " Send answer to ", fromId);
                        socket.emit("signaling", {
                          type: "sdp",
                          toId: fromId,
                          description: connections[fromId].localDescription,
                        });
                      });
                  })
                  .catch(handleError);
              }
            })
            .catch(handleError);
        }
        break;
    }
  }
}

function gotIceCandidate(fromId, candidate) {
  //새로운 ICE Candidate를 브라우저에 전달함으로써 연결.
  connections[fromId]
    .addIceCandidate(new RTCIceCandidate(candidate))
    .catch(handleError);
}

function getUserCam(mediaStream) {
  //출력할 영상을 자신의 캠으로 지정해준다.
  localStream = mediaStream;
  localVideo.srcObject = mediaStream;
}

function handleError(e) {
  console.log(e);
  alert("err occured");
}

startLocalStream();
