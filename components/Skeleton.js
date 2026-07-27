import styles from "./Skeleton.module.css";

export default function Skeleton({ width = "100%", height = 16, style }) {
  return <div className={styles.skeleton} style={{ width, height, ...style }} />;
}
