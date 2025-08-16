import json
from channels.generic.websocket import AsyncWebsocketConsumer
import random

class GameConsumer(AsyncWebsocketConsumer):
    players = {}  # Dictionary to store player information
    p_turn = None
    pkd_color = None
    async def receive(self, text_data):
        """
        Handle inbound messages from the client (classic branch diagnostics).
        """
        import json, traceback, sys
        try:
            data = json.loads(text_data or "{}")
        except Exception:
            data = {}
        message_type = data.get("type")
        try:
            print(f"[WS] recv type={message_type} data_keys={list(data.keys())}", file=sys.stderr)
        except Exception:
            pass

        try:
            # Pass through existing classic handlers:
            if message_type == "clue_message":
                print("[DEBUG] recv clue_message room=" + str(self.room_name) + " msg=" + str(data.get("message","")))
                print("[DEBUG] group_send clue_message -> " + str(self.room_group_name))
                # broadcast to the room (avoid sending to specific/possibly closed channels)
                try:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {"type": "clue_message", "message": data.get("message", "")}
                    )
                except Exception:
                    traceback.print_exc()

            elif message_type == "guess_message":
                try:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {"type": "guess_message", "message": data.get("message", "")}
                    )
                except Exception:
                    traceback.print_exc()

            # Add other message types here as no-ops to avoid crashes in classic mode
            else:
                # ignore unknowns in classic branch
                pass

        except Exception:
            traceback.print_exc()
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = "game_%s" % self.room_name

        # Join room group
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)

        await self.accept()
        
        await self.channel_layer.group_add(self.room_name, self.channel_name)

    async def disconnect(self, close_code):
        # Remove player from the list when disconnecting
        if self.channel_name in GameConsumer.players:
            del GameConsumer.players[self.channel_name]

            # Broadcast updated player list
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "player_list", 
                    "players": list(filter(
                        lambda x: x.get("room") == self.room_name, GameConsumer.players.values()
                    ))
                }
            )

        # Leave room group
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        message_type = text_data_json["type"]

        if message_type == "clue_message":
            message = text_data_json["message"]
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "clue_message", "message": message}
            )
        elif message_type == "add_player":
            # Create a new player
            # get the player id based off of the index of the player in the list + 1
            id = len(list(GameConsumer.players.values())) + 1
            # set player values from passed in data
            name = text_data_json["name"]
            color = text_data_json["color"]
            points = text_data_json["points"]
            guesses = text_data_json["guesses"]
            # add the player to the global players list
            GameConsumer.players[self.channel_name] = {
                'id': id, 
                "name": name, 
                "color": color, 
                "points": points,  
                "guesses": guesses,
                "room": self.room_name,
            }
            # get the channel name - player window name
            text_data_json["channel_name"] = self.channel_name
            # send the new player list to the group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "player_list", 
                    "players": list(filter(
                        lambda x: x.get("room") == self.room_name, GameConsumer.players.values()
                    ))
                }
            )
        elif message_type == "get_player":
            player = GameConsumer.players[self.channel_name]
            await self.send(
                text_data=json.dumps(
                    {"type": "current_player", "player": player}
                )
            )
        elif message_type == "update_player":
            id = text_data_json['id']
            name = text_data_json['name']
            color = text_data_json['color']
            points = text_data_json['points']
            guesses = text_data_json['guesses']
            for plyr in GameConsumer.players.values():
                if plyr['id'] == id:
                    plyr['points'] = points
                    plyr['guesses'] = guesses
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "update_player", 
                    "players": list(filter(
                        lambda x: x.get("room") == self.room_name, GameConsumer.players.values()
                    ))
                }
            )
        elif message_type == "player_turn":
            # send the current player's turn
            await self.channel_layer.group_send(
                self.room_group_name,
                {"type": "player_turn", "player": GameConsumer.p_turn}
            )
        elif message_type == "next_turn_request":
            # get the player whose turn it is
            player = text_data_json["next_player_turn"]
            # set the p_turn global variable to the player whose turn it is
            GameConsumer.p_turn = player['id']
            # send the player whose turn it is back to everyone
            await self.channel_layer.group_send (
                self.room_group_name,
                {
                    'type': 'turn_update',
                    'player': GameConsumer.p_turn,
                }
            )
        elif message_type == "color_selection":
            xCoord = text_data_json["x_coord"]
            yCoord = text_data_json["y_coord"]
            color = text_data_json["color"]
            
            GameConsumer.pkd_color = {
                'x_coord': xCoord,
                'y_coord': yCoord,
                'color': color,
            }
            await self.channel_layer.group_send (
                self.room_group_name,
                {
                    'type': 'update_picked_color',
                    'picked_color': GameConsumer.pkd_color,
                }
            )
        elif message_type == "guess_submission":
            guess = text_data_json["guess"]
            player = GameConsumer.players[self.channel_name]
            player["guesses"].append(guess)
            
            total_guesses = 0
            guesses_multiplier = 1
            
            for plyr in GameConsumer.players.values():
                len_player_guesses = len(plyr['guesses'])
                total_guesses += len_player_guesses
                if (len_player_guesses > 0):
                    guesses_multiplier = len_player_guesses
                            
            if (len(GameConsumer.players) - 1) * guesses_multiplier == total_guesses:
                await self.channel_layer.group_send (
                    self.room_group_name,
                    {
                        'type': 'all_guesses_received', 
                        'players': GameConsumer.players,
                        'picked_color': GameConsumer.pkd_color,
                    }
                )
            else:
                await self.send(
                text_data=json.dumps(
                    {"type": "guess_submission", "player": player}
                )
            )
        else:
            print("ERROR: incorrect message type in consumer - ", message_type)

    async def clue_message(self, event):
        print("[DEBUG] outbound clue_message event=" + str(event))
        message = event["message"]
        await self.send(text_data=json.dumps(
            {
                "type": "clue_message", 
                "message": message,
                'is_player_turn': GameConsumer.players[self.channel_name]['id'] ==  GameConsumer.p_turn,
            }
        ))

    async def player_list(self, event):
        # get the player list from the group send event
        players = event["players"]
        # for each player, send back the player list
        await self.send(text_data=json.dumps({"type": "player_list", "players": players}))
        
    async def update_player(self, event):
        players = event['players']
        await self.send(text_data=json.dumps({"type": 'update_player', 'players': players}))
        
    async def player_turn(self, event):
        player = event['player']
        # send the player whose turn it is to each player
        await self.send(text_data=json.dumps({"type": "player_turn", "player": player}))
        
    async def turn_update(self, event):
        # get the player whose turn it is
        player = event['player']
        type = event['type']
        # for each person, send whether it is their turn
        await self.send(text_data=json.dumps(
            {
                'type': 'turn_update',
                'player': player,
                'cur_player': GameConsumer.players[self.channel_name],
                'is_player_turn': GameConsumer.players[self.channel_name]['id'] ==  GameConsumer.p_turn
            }
        ))
        
    async def update_picked_color(self, event):
        type = event['type']
        await self.send(text_data=json.dumps(
            {
                'type': type,
                'picked_color': GameConsumer.pkd_color,
            }
        ))
    
    async def all_guesses_received(self, event):
        await self.send(text_data=json.dumps(
            {
                'type': 'all_guesses_received', 
                'players': GameConsumer.players,
                'picked_color': GameConsumer.pkd_color,
                'cur_player': GameConsumer.players[self.channel_name],
            }
        ))
        
    async def end_round(self, event):
        await self.send(text_data=json.dumps(event))
        
