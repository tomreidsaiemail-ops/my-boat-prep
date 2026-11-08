"""Safety-first default Role Briefings for every role in the admin Crew Roles list (written once, on deploy)."""
import logging
from datetime import datetime, timezone

from db import db
from templates import _role_key, push_role_briefings

SAFETY_BRIEFINGS = {
    # Navigation & Communications
    "radio operator": "VHF 16 is monitored at all times. Know the boat's name, callsign and MMSI, and where the position is shown, before you ever need them. "
                      "MAYDAY is only for grave and imminent danger to life or the vessel; PAN-PAN for urgent help. Speak slowly, repeat the position, and log every safety call. "
                      "The red DSC distress button sends our position automatically: lift the cover, hold it for 5 seconds.",
    "primary navigator": "Keep a plot of our position at least every hour, more often near hazards, and know where we are before the skipper asks. "
                         "Check the chart for rocks, shallows, shipping lanes and restricted areas ahead, and never rely on one source: cross-check GPS with depth, bearings and eyes. "
                         "Tell the skipper early about weather changes or tidal gates. Wear your lifejacket when you come up on deck.",
    "backup navigator": "Be ready to take over navigation at any moment. Know how to read our position from the chartplotter and from the handheld GPS if the main one fails. "
                        "Keep the paper chart and last logged position up to date, and know where the grab bag GPS and flares are kept.",
    "helmsman": "Keep a proper lookout all round, including behind the headsail, and know the collision rules: power gives way to sail, but never assume they've seen us. "
                "Call every tack, gybe and big course change clearly and wait for 'ready'. Steer away from the boom's path and never gybe without warning the crew. "
                "If someone goes overboard, shout 'MAN OVERBOARD', point, and hit MOB on the plotter.",
    "logbook keeper": "Log position, course, speed, weather, barometer and engine hours at least every hour, and at every watch change. "
                      "In an emergency the last logged position is what rescuers use, so write it first. Note every safety event, injury and radio call with the time.",
    "ais & radar monitor": "Watch for any vessel with a closest point of approach under 1 nautical mile and tell the helm early. "
                           "Remember small craft, kayaks and some fishing boats don't show on AIS, so keep looking out with your eyes too. "
                           "At night and in fog, check the radar every few minutes and call out new targets.",
    # Safety & Emergency
    "mob spotter": "If someone goes overboard, shout 'MAN OVERBOARD!', point at them with your arm straight and never take your eyes off them, whatever else is happening. "
                   "Keep pointing and calling the distance and direction until they are back on board. Ask someone else to press MOB and throw the lifebuoy.",
    "mob pointer (never lose sight)": "Your only job in a man overboard is to keep your eyes on the person in the water and your arm pointing at them. "
                                      "Do not look away to help with sails or lines, even for a second; a head in waves disappears in moments. Call out 'still in sight' so the helm can steer to them.",
    "mob recovery specialist": "Know where the lifebuoy, throw line, recovery sling and boarding ladder are, and how the recovery is rigged on this boat. "
                               "Approach downwind or as the skipper briefs, engine in neutral near the person so the propeller can't hurt them. "
                               "Clip on before leaning over the side. Lift people horizontally if they have been in cold water a while.",
    "medical officer": "Know where the first aid kit, medications and the crew's medical notes and allergies are kept. "
                       "Check every crew member's seasickness, allergies and medication needs before departure. "
                       "For serious injury, call for medical advice on VHF or phone early. Stop bleeding, keep them warm, and note times and symptoms in the log.",
    "first aid responder": "Know where the first aid kit is and check it before departure. Make the scene safe first: don't become a second casualty on a moving deck. "
                           "Call the skipper, treat bleeding, burns and head knocks, and keep the person warm and still. "
                           "Watch for seasickness turning into dehydration or hypothermia.",
    "fire marshall": "Know where every fire extinguisher and the fire blanket are, and check their gauges before departure. "
                     "Galley fires: turn off the gas at the bottle and use the fire blanket, never water on oil. Engine fires: stop the engine, shut off fuel, and only open the hatch a crack. "
                     "If a fire can't be put out quickly, get everyone on deck in lifejackets and call MAYDAY.",
    "life raft deployment lead": "Know where the life raft is, how it's secured, and that the painter must be tied to the boat before it's thrown. "
                                 "Only abandon ship when the boat is sinking under you: step up into the raft. "
                                 "Take the grab bag, EPIRB and water, and get everyone in lifejackets first.",
    "grab bag manager": "Keep the grab bag packed, dry and by the companionway: EPIRB or PLB, handheld VHF, flares, torch, water, first aid, sunscreen, seasickness tablets and copies of documents. "
                        "Check batteries and expiry dates before each trip. In an emergency it goes with you, clipped to you, into the life raft.",
    "safety equipment inspector": "Before departure, check every lifejacket (inflated cylinder, auto-firing head in date, crotch strap), harnesses and tethers, jacklines, flares, EPIRB, lifebuoy and fire extinguishers. "
                                  "Show every crew member how to wear and adjust their lifejacket. Report anything faulty to the skipper before we leave.",
    # Deck Operations
    "anchor lead": "Keep fingers, feet and loose clothing clear of the windlass and chain at all times, and never stand on or straddle the chain. "
                   "Use hand signals agreed with the helm; noise and wind drown out voices. Make the chain fast to the cleat or snubber, not the windlass, once we're set. "
                   "Wear shoes on the foredeck.",
    "foredeck manager": "Never step into an open foredeck hatch: check every hatch is shut before working forward, and close it if you find it open. "
                        "One hand for the boat at all times; keep low, clip on in rough weather and move along the windward side. "
                        "Watch for sheets and the boom when the boat tacks or gybes.",
    "stern deck lead": "Watch for the propeller whenever people or lines are in the water near the stern: call 'neutral!' to the helm. "
                       "Keep lines tidy and coiled so nobody trips, and keep fingers clear of cleats and winches under load. Keep children and guests clear of the stern during mooring.",
    "fender manager": "Set fenders at the right height before we come alongside and move them, don't fend off with hands, arms or feet. "
                      "Never put any part of your body between the boat and the dock or another boat; a boat weighs tonnes. Use a roving fender instead.",
    "line handler (bow)": "Step, don't jump, ashore, and only when the boat is close and the skipper says so. "
                          "Keep fingers clear of the cleat when the line takes load: take a turn and let it slip under control. Never wrap a line around your hand. "
                          "Watch for the open foredeck hatch.",
    "line handler (stern)": "Step, don't jump, ashore, and only when the skipper says so. Keep the stern line clear of the propeller; call 'line in the water!' if it goes over. "
                            "Take a turn on the cleat before load comes on, and keep fingers clear of the cleat.",
    "line handler (midships)": "The midships spring line is usually the first line ashore and stops the boat: step, don't jump, and only when close. "
                               "Take a turn on the cleat quickly and ease under control; never wrap the line around your hand or stand in a loop of rope.",
    "tender driver": "Everyone in the tender wears a lifejacket, and you wear the kill cord at all times when the engine is running. "
                     "Slow down near swimmers, divers and moorings, and never come alongside with people in the water near the propeller. "
                     "Carry the handheld VHF, a torch at dusk, and tell the skipper where you're going and when you'll be back.",
    "swim platform guard": "Before anyone swims, the engine is off and the skipper has said so: call 'engine off?' and wait for the answer. "
                           "Watch every swimmer the whole time, count heads in and out, and keep the lifebuoy and throw line ready. "
                           "Swimmers stay clear of the boat when the tender is moving.",
    # Logistics & Interior
    "provision manager": "Stow heavy tins and bottles low and secured so they can't fly about when heeled. Check the crew's allergies and dietary needs before you shop. "
                         "Carry extra drinking water and food for delays, and keep perishable food cold and separate from raw meat.",
    "galley lead / chef": "Turn on the gas at the bottle only when cooking and off straight after. Use the gimbal lock and galley strap in a seaway, and wear an apron or oilskins to protect against hot spills. "
                          "Keep pans small and lids on; never leave a lit stove. Watch for the crew's allergies.",
    "hydration & water manager": "Make sure every crew member drinks water regularly, especially in sun, wind and when seasick: dehydration makes seasickness and fatigue worse. "
                                 "Track the water tanks and keep a reserve of bottled water in the grab bag. Watch for signs of heat stress.",
    "waste & recycling manager": "Nothing plastic goes over the side, ever. Keep rubbish bags sealed and stowed away from food. "
                                 "Food waste may only go over the side well offshore where allowed. Know the local rules for black water and pump-out.",
    "interior steward": "Keep the cabin clear: anything loose becomes a missile when the boat heels. Close and latch lockers, drawers and hatches before we sail. "
                        "Keep the companionway clear and dry, and lights on below at night so crew coming down don't fall.",
    "inventory controller": "Know where the safety gear is stowed as well as the food and spares: flares, first aid, fire blankets, torches. "
                            "Keep heavy items low and secured, and tell the skipper when anything safety-related runs low.",
    "cleaning coordinator": "Keep the deck and cockpit free of oil, soap and slippery spills, and rinse the decks with sea water. "
                            "Ventilate when using cleaning chemicals below, never mix bleach with other cleaners, and keep the heads clean to stop illness spreading.",
    # Engineering & Technical
    "lead engineer": "Check engine oil, coolant, belts and the raw water strainer before departure. "
                     "Keep hands, hair and loose clothing well clear of a running engine, and switch it off before touching belts or pulleys. "
                     "Know where the fuel and seacock shut-offs are, and where the fire extinguisher for the engine space is.",
    "engine room inspector": "Turn the engine off before reaching in, and let it cool: manifolds and exhausts burn. "
                             "Look for fuel, oil and water leaks, loose hoses and clips, and smell for diesel or exhaust. Close the engine space properly afterwards.",
    "electrical & battery monitor": "Watch battery voltage and don't let the house bank drop below 50%. "
                                    "Isolate the circuit before working on wiring, and never short battery terminals with tools or jewellery. "
                                    "Batteries charging give off explosive gas: keep sparks and flames away and ventilate.",
    "it & satellite comms tech": "Make sure the satellite phone, chartplotter and devices are charged and backed up, with offline charts downloaded. "
                                 "Know how to send a distress alert on every device. Keep cables tidy so nobody trips, and keep electronics dry.",
    "plumbing & head technician": "Brief every crew member how to use the head: only toilet paper and waste go in, and close the seacocks after use if the skipper asks. "
                                  "Know where every seacock is and how to close it fast in a leak. Wear gloves for head maintenance and wash your hands well.",
    "bilge & pump monitor": "Check the bilge at least every watch and tell the skipper straight away if water is rising. "
                            "Know where the manual bilge pump handle is and how to use it, and test the electric pump before departure. "
                            "Taste a drop: fresh water means a tank leak, salt water means a hull or seacock leak.",
    "fuel manager": "No smoking or flames while refuelling. Close hatches and portholes, and switch off the engine and gas. "
                    "Use an absorbent pad to catch drips; spilled diesel makes decks dangerously slippery. Keep a 20% fuel reserve and log fuel added.",
    # Racing Roles
    "port trim": "Watch out for the boom at all times! Put 3 to 4 wraps clockwise on the winch drum, keep your thumbs out and palms facing the winch, "
                 "and never wrap the tail around your hand or body. Ease under load by feeding the turns slowly, not by taking them off. "
                 "Take the winch handle out when you're done so it can't spin or fly.",
    "starboard trim": "Watch out for the boom at all times! Put 3 to 4 wraps clockwise on the winch drum, keep your thumbs out and palms facing the winch, "
                      "and never wrap the tail around your hand or body. Ease under load by feeding the turns slowly, not by taking them off. "
                      "Take the winch handle out when you're done so it can't spin or fly.",
    "mainsheet": "The mainsheet carries huge loads: keep fingers clear of the blocks and never stand in a bight of the sheet. "
                 "Call 'boom coming across!' on every gybe and control it with the sheet; an uncontrolled gybe can injure anyone in its path. "
                 "Ease the traveller and sheet first if the boat is overpowered.",
    "helm": "Call every tack and gybe clearly and wait for the crew to be ready. Keep a lookout to leeward behind the headsail, especially near the start line and marks. "
            "Know the racing rules but avoid collisions above all. "
            "If someone goes overboard, shout 'MAN OVERBOARD', keep the boat under control, and hit MOB.",
    "foredeck (headsail/spinnaker)": "Never step into the foredeck hatch: check it's closed before you go forward, and watch for it during sail drops. "
                                     "Keep low, one hand for the boat, and clip on in rough weather. "
                                     "Stay clear of the spinnaker pole and sheets under load, and never stand in a coil of halyard or sheet.",
}


async def seed_role_safety_briefings():
    """Runs once: writes a safety Role Briefing onto every matching role in the admin Crew Roles list, then onto boats' roles that have none."""
    if await db.migrations.find_one({"_id": "role_safety_briefings"}):
        return
    now = datetime.now(timezone.utc).isoformat()
    tpl = await db.list_templates.find_one({"custom": True, "name": {"$regex": r"^\s*crew roles\s*$", "$options": "i"}}, {"_id": 1, "items": 1})
    if not tpl:
        return
    items = [{**i, "briefing": SAFETY_BRIEFINGS[_role_key(i.get("label", ""))]} if _role_key(i.get("label", "")) in SAFETY_BRIEFINGS else i
             for i in tpl.get("items") or []]
    missed = [i.get("label") for i in tpl.get("items") or [] if i.get("indent") and _role_key(i.get("label", "")) not in SAFETY_BRIEFINGS]
    if missed:
        logging.getLogger(__name__).info("Role safety briefings: no default for %s", missed)
    if items != tpl.get("items"):
        await db.list_templates.update_one({"_id": tpl["_id"]}, {"$set": {"items": items, "updated_at": now}})
    await push_role_briefings(items, now)
    await db.migrations.insert_one({"_id": "role_safety_briefings", "at": now})
