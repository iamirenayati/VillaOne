import styles from "./Diorama.module.css";

export function DioramaPoster() {
  return (
    <div className={styles.poster} aria-hidden="true">
      <span className={styles.posterMoon} />
      <span className={styles.posterMist} />
      <span className={styles.posterIsland} />
      <span className={styles.posterVilla}><i /><i /><i /></span>
      <span className={styles.posterTrees}><i /><i /><i /><i /><i /></span>
      <span className={styles.posterWater} />
      <span className={styles.posterMotes}><i /><i /><i /><i /><i /></span>
    </div>
  );
}
