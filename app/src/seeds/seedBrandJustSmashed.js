import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const BRAND_ID = "justsmashed";

export default async function seedBrandJustSmashed() {
  const brandRef = doc(db, "brands", BRAND_ID);
  if (!(await getDoc(brandRef)).exists()) {
    await setDoc(brandRef, {
      name: "JustSmashed",
      categories: ["burgers", "wings", "fries"],
      isActive: true,
    });
  }

  const items = [
    { id: "double-cheese-burger",    name: "Double Cheese Burger",            category: "burgers" },
    { id: "double-chilli-cheese",    name: "Double Chilli & Cheese Burger",   category: "burgers" },
    { id: "oklahoma-smashed-burger", name: "Oklahoma Smashed Burger",         category: "burgers" },
    { id: "veggie-burger",           name: "Veggie Burger",                   category: "burgers" },
    { id: "bbq-lovers",              name: "BBQ Lovers",                      category: "burgers" },
    { id: "double-cheese-bacon",     name: "Double Cheese & Bacon Burger",    category: "burgers" },
    { id: "crunchy-chikn-burger",    name: "Crunchy Chik’n Burger",           category: "burgers" },
    { id: "spicy-fried-chicken",     name: "Spicy Fried Chicken",             category: "burgers" },
    { id: "fries-chikn",             name: "Loaded Fries Chik’n",             category: "fries" },
    { id: "fries-beef",              name: "Loaded Fries Beef",               category: "fries" },
    { id: "smoky-sesame-wings",      name: "Smoky Sesame Wings",              category: "wings" },
    { id: "sweet-heat-wings",        name: "Sweet Heat Wings",                category: "wings" },
    { id: "trueffel-fries-deluxe",   name: "Trüffel Fries Deluxe",            category: "fries" },
  ];

  const placeholderImg =
    "https://images.unsplash.com/photo-1";

  for (const it of items) {
    const itemRef = doc(db, "brands", BRAND_ID, "menuItems", it.id);
    if (!(await getDoc(itemRef)).exists()) {
      await setDoc(itemRef, {
        ...it,
        description: "",
        image: placeholderImg,
        order: 0,
        isActive: true,
      });

      const burgerReqs = [
        {
          id: "built-straight",
          title: "BUILT BURGER",
          angleHint: "PICTURE ANGLE: STRAIGHT ON",
          exampleImageUrl: placeholderImg,
          verifyingDetails: [
            "Split top bun",
            "Thin smashed patty covers bottom bun",
            "Melted cheese",
          ],
        },
        {
          id: "cut-in-half",
          title: "BUILT BURGER, CUT IN HALF",
          angleHint: "PICTURE ANGLE: STRAIGHT ON",
          exampleImageUrl: placeholderImg,
          verifyingDetails: [],
        },
      ];

      const genericReqs = [
        {
          id: "portion-top",
          title: "PORTION — TOP VIEW",
          angleHint: "PICTURE ANGLE: TOP DOWN",
          exampleImageUrl: placeholderImg,
          verifyingDetails: ["Garnish visible", "Clean plating"],
        },
      ];

      const reqs = it.category === "burgers" ? burgerReqs : genericReqs;

      for (const r of reqs) {
        const reqRef = doc(
          db,
          "brands",
          BRAND_ID,
          "menuItems",
          it.id,
          "requirements",
          r.id
        );
        if (!(await getDoc(reqRef)).exists()) {
          await setDoc(reqRef, r);
        }
      }
    }
  }
}
